import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit, LIMITS } from '@/lib/security/rateLimit';

// POST /api/offers/:id/cart — add the product from an ACCEPTED, unexpired offer to the buyer's cart at the
// agreed price. GET /api/cart (and checkout) read that price straight from the offer, never from the browser.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    { const limited = await rateLimit(request, LIMITS.cart, user.id); if (limited) return limited; }

    const admin = createAdminClient();
    const { data: profile } = await admin.from('profiles').select('id, account_status').eq('auth_user_id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    if (profile.account_status !== 'ACTIVE') return NextResponse.json({ error: 'Your account is not active' }, { status: 403 });

    const { data: offer } = await admin.from('offers').select('id, product_id, buyer_id, status, expires_at, amount').eq('id', params.id).maybeSingle();
    if (!offer || offer.buyer_id !== profile.id) return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    if (offer.status !== 'ACCEPTED') return NextResponse.json({ error: 'This offer is not accepted' }, { status: 409 });
    if (!offer.expires_at || new Date(offer.expires_at).getTime() < Date.now()) return NextResponse.json({ error: 'This offer has expired' }, { status: 409 });

    const { data: product } = await admin.from('products').select('id, status, quantity').eq('id', offer.product_id).maybeSingle();
    if (!product || product.status !== 'ACTIVE' || Number(product.quantity ?? 1) < 1) {
      return NextResponse.json({ error: 'This item is no longer available' }, { status: 409 });
    }

    let { data: cart } = await admin.from('carts').select('id').eq('profile_id', profile.id).maybeSingle();
    if (!cart) {
      const { data: newCart, error: cartError } = await admin.from('carts').insert({ profile_id: profile.id }).select('id').single();
      if (cartError || !newCart) throw cartError ?? new Error('could not create cart');
      cart = newCart;
    }

    const { data: existing } = await admin.from('cart_items').select('id').eq('cart_id', cart.id).eq('product_id', product.id).maybeSingle();
    if (existing) {
      const { error } = await admin.from('cart_items').update({ offer_id: offer.id }).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await admin.from('cart_items').insert({ cart_id: cart.id, product_id: product.id, quantity: 1, offer_id: offer.id });
      if (error) throw error;
    }

    return NextResponse.json({ success: true, price: Number(offer.amount) }, { status: 201 });
  } catch (err) {
    console.error('[API] offer add-to-cart', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
