import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { getFastUser } from '@/lib/auth/session';
import { rateLimit, LIMITS } from '@/lib/security/rateLimit';

const addToCartSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(1), // Second-hand: max 1
});

const removeFromCartSchema = z.object({
  cartItemId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
}).refine((v) => v.cartItemId || v.productId, 'cartItemId or productId required');

const updateQuantitySchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(0).max(99), // 0 removes the item
});

// GET /api/cart
export async function GET() {
  try {
    const supabase = await createServerClient();

    // Who is asking: the token is verified locally (no round trip to the auth server). Guests simply have an empty cart.
    const user = await getFastUser(supabase);
    if (!user) return NextResponse.json({ guest: true, cartId: null, items: [], total: 0, itemCount: 0 });

    // ONE query. Row-level security already limits cart_items to the caller's own cart, so there is no need to look
    // up the profile and the cart first (that was three sequential round trips before).
    const { data: items, error } = await supabase
      .from('cart_items')
      .select(`
        id, quantity, added_at,
        products(
          id, title, price, original_price, condition, status, location, quantity,
          profiles!products_seller_id_fkey(full_name, verification_status),
          product_images(storage_path, is_primary)
        )
      `)
      .order('added_at', { ascending: false });

    if (error) throw error;

    // Filter out items where product is no longer available
    // (`product` alias: the client reads item.product, PostgREST names it `products`)
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const activeItems = ((items || []) as any[])
      .map((item) => ({
        ...item,
        product: item.products && { ...item.products, seller: item.products.profiles },
      }))
      .filter((item) => item.product?.status === 'ACTIVE');

    const total = activeItems.reduce(
      (sum: number, item: any) => sum + (Number(item.product?.price) || 0) * item.quantity,
      0
    );

    return NextResponse.json({
      cartId: null,
      items: activeItems,
      total,
      itemCount: activeItems.length,
    });

  } catch (error) {
    console.error('[API] Cart GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/cart — add item
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, account_status')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Buying never requires identity verification — only selling does
    if (profile.account_status && profile.account_status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Your account is not active' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = addToCartSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { productId, quantity } = parsed.data;

    // Verify product is available
    const { data: product } = await supabase
      .from('products')
      .select('id, status, seller_id, title, price')
      .eq('id', productId)
      .single();

    if (!product || product.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Product is not available' }, { status: 409 });
    }

    // Cannot add own listing to cart
    if (product.seller_id === profile.id) {
      return NextResponse.json({ error: 'Cannot add your own listing to cart' }, { status: 409 });
    }

    // Get or create cart
    let { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('profile_id', profile.id)
      .single();

    if (!cart) {
      const { data: newCart } = await supabase
        .from('carts')
        .insert({ profile_id: profile.id })
        .select('id')
        .single();
      cart = newCart;
    }

    if (!cart) {
      return NextResponse.json({ error: 'Could not create cart' }, { status: 500 });
    }

    // Check if already in cart
    const { data: existing } = await supabase
      .from('cart_items')
      .select('id')
      .eq('cart_id', cart.id)
      .eq('product_id', productId)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Item already in cart' }, { status: 409 });
    }

    const { error: insertError } = await supabase
      .from('cart_items')
      .insert({
        cart_id: cart.id,
        product_id: productId,
        quantity,
      });

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, message: 'Added to cart' }, { status: 201 });

  } catch (error) {
    console.error('[API] Cart POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/cart — remove item
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    { const limited = await rateLimit(request, LIMITS.cart, user.id); if (limited) return limited; }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = removeFromCartSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    // Verify ownership through cart (by cart item id, or by product id for the quick +/- controls)
    let itemQuery = supabase.from('cart_items').select('id, carts!inner(profile_id)');
    itemQuery = parsed.data.cartItemId ? itemQuery.eq('id', parsed.data.cartItemId) : itemQuery.eq('product_id', parsed.data.productId!).eq('carts.profile_id', profile.id);
    const { data: cartItem } = await itemQuery.maybeSingle();

    if (!cartItem) {
      return NextResponse.json({ error: 'Cart item not found' }, { status: 404 });
    }

    if ((cartItem.carts as unknown as { profile_id: string }).profile_id !== profile.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await supabase.from('cart_items').delete().eq('id', cartItem.id);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[API] Cart DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/cart — set the quantity of a product in the cart (0 removes it). Never above the listing's stock.
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    
    { const limited = await rateLimit(request, LIMITS.cart, user.id); if (limited) return limited; }const { data: profile } = await supabase.from('profiles').select('id').eq('auth_user_id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const parsed = updateQuantitySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const { productId, quantity } = parsed.data;

    const { data: cart } = await supabase.from('carts').select('id').eq('profile_id', profile.id).maybeSingle();
    if (!cart) return NextResponse.json({ error: 'Cart not found' }, { status: 404 });

    const { data: item } = await supabase.from('cart_items').select('id').eq('cart_id', cart.id).eq('product_id', productId).maybeSingle();
    if (!item) return NextResponse.json({ error: 'Item not in cart' }, { status: 404 });

    if (quantity === 0) {
      await supabase.from('cart_items').delete().eq('id', item.id);
      return NextResponse.json({ success: true, quantity: 0 });
    }

    const { data: product } = await supabase.from('products').select('quantity, status').eq('id', productId).single();
    if (!product || product.status !== 'ACTIVE') return NextResponse.json({ error: 'This item is no longer available' }, { status: 409 });
    const stock = product.quantity ?? 1;
    if (quantity > stock) {
      return NextResponse.json({ error: stock === 1 ? 'Only 1 is available' : `Only ${stock} available`, stock }, { status: 409 });
    }

    const { error } = await supabase.from('cart_items').update({ quantity }).eq('id', item.id);
    if (error) throw error;
    return NextResponse.json({ success: true, quantity });
  } catch (error) {
    console.error('[API] Cart PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
