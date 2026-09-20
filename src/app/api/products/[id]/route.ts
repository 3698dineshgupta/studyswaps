import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit, LIMITS } from '@/lib/security/rateLimit';

// .strict(): unknown fields (seller_id, role, status, quantity …) are REJECTED, never silently applied.
// Listing status and stock are never editable by the seller from here (moderation and payments own them).
const updateProductSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(10).max(5000).optional(),
  price: z.number().positive().max(9999999).optional(),
  condition: z.enum(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR']).optional(),
  location: z.string().trim().max(200).optional(),
  isNegotiable: z.boolean().optional(),
}).strict();

const idSchema = z.string().uuid();

// GET /api/products/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!idSchema.safeParse(params.id).success) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    const supabase = await createServerClient();

    const { data: product, error } = await supabase
      .from('products')
      .select(`
        id, title, description, price, original_price, condition, location, quantity,
        is_negotiable, delivery_available, delivery_charge, preferred_meeting_point,
        brand, model, year_purchased, seller_id,
        status, view_count, created_at, updated_at,
        profiles!products_seller_id_fkey(
          id, full_name, verification_status, location, created_at, profile_photo, seller_rating, seller_review_count, total_sales
        ),
        product_images(id, storage_path, is_primary, sort_order),
        categories(id, name, slug)
      `)
      .eq('id', params.id)
      .single();

    if (error || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Only show active products to the public (sellers can see their own drafts via dashboard)
    if (product.status !== 'ACTIVE' && product.status !== 'SOLD') {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }
      // Check if it's the seller
      const { data: sellerProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (!sellerProfile || (product.profiles as unknown as { id: string })?.id !== sellerProfile.id) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }
    }

    // Increment view count (fire and forget)
    supabase
      .from('products')
      .update({ view_count: (product.view_count || 0) + 1 })
      .eq('id', params.id)
      .then(() => {});

    // Aliases the product page reads (seller / negotiable / images)
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const p = product as any;
    return NextResponse.json({
      product: {
        ...p,
        seller: p.profiles,
        negotiable: p.is_negotiable,
        images: [...(p.product_images ?? [])].sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.sort_order - b.sort_order),
        category: p.categories,
      },
    });

  } catch (error) {
    console.error('[API] Product GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/products/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!idSchema.safeParse(params.id).success) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check ownership (RLS also enforces this server-side)
    const { data: product } = await supabase
      .from('products')
      .select('id, seller_id, status')
      .eq('id', params.id)
      .single();

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (product.seller_id !== profile.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Cannot edit sold/archived products
    if (['SOLD', 'ARCHIVED'].includes(product.status)) {
      return NextResponse.json(
        { error: 'Cannot edit a sold or archived product' },
        { status: 409 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.price !== undefined) updates.price = parsed.data.price;
    if (parsed.data.condition !== undefined) updates.condition = parsed.data.condition;
    if (parsed.data.location !== undefined) updates.location = parsed.data.location;
    if (parsed.data.isNegotiable !== undefined) updates.is_negotiable = parsed.data.isNegotiable;

    // Ownership was verified above; the write itself goes through the server (sellers have no direct column access)
    const admin = createAdminClient();
    const { error: updateError } = await admin
      .from('products')
      .update(updates)
      .eq('id', params.id);

    if (updateError) throw updateError;

    await admin.from('audit_logs').insert({
      actor_id: profile.id,
      actor_email: user.email,
      action: 'LISTING_UPDATED',
      entity_type: 'product',
      entity_id: params.id,
      new_data: { updates: Object.keys(updates) },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[API] Product PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/products/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!idSchema.safeParse(params.id).success) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { data: product } = await supabase
      .from('products')
      .select('id, seller_id, status')
      .eq('id', params.id)
      .single();

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (product.seller_id !== profile.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (product.status === 'SOLD') {
      return NextResponse.json({ error: 'Cannot delete a sold item' }, { status: 409 });
    }

    // Soft delete — archive instead
    const admin = createAdminClient();
    await admin
      .from('products')
      .update({ status: 'ARCHIVED', updated_at: new Date().toISOString() })
      .eq('id', params.id);

    await admin.from('audit_logs').insert({
      actor_id: profile.id,
      actor_email: user.email,
      action: 'LISTING_DELETED',
      entity_type: 'product',
      entity_id: params.id,
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[API] Product DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
