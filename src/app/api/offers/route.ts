import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getFastUser } from '@/lib/auth/session';
import { rateLimit, LIMITS } from '@/lib/security/rateLimit';
import { notify } from '@/lib/notify';
import { checkOfferAmount, round2 } from '@/lib/offers';

const createSchema = z.object({
  productId: z.string().uuid(),
  amount: z.number().finite().positive().max(10_000_000),
  message: z.string().trim().max(300).optional(),
});

const AMOUNT_ERROR: Record<string, string> = {
  TOO_LOW: 'Your offer is too low for this item.',
  TOO_HIGH: 'An offer can\'t be more than the asking price — use Buy Now instead.',
};

// POST /api/offers — a buyer offers a price on a negotiable listing
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    { const limited = await rateLimit(request, LIMITS.offer, user.id); if (limited) return limited; }

    const admin = createAdminClient();
    const { data: profile } = await admin.from('profiles').select('id, full_name, account_status').eq('auth_user_id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    if (profile.account_status !== 'ACTIVE') return NextResponse.json({ error: 'Your account is not active' }, { status: 403 });

    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Please enter a valid offer amount' }, { status: 400 });
    const { productId, amount, message } = parsed.data;
    const roundedAmount = round2(amount);

    const { data: product } = await admin
      .from('products')
      .select('id, title, price, status, seller_id, is_negotiable')
      .eq('id', productId)
      .maybeSingle();
    if (!product || product.status !== 'ACTIVE') return NextResponse.json({ error: 'This listing is not available' }, { status: 409 });
    if (!product.is_negotiable) return NextResponse.json({ error: 'The seller is not accepting offers on this listing' }, { status: 403 });
    if (product.seller_id === profile.id) return NextResponse.json({ error: 'You cannot make an offer on your own listing' }, { status: 409 });

    const amountError = checkOfferAmount(roundedAmount, Number(product.price));
    if (amountError) return NextResponse.json({ error: AMOUNT_ERROR[amountError] }, { status: 400 });

    const { data: created, error: insertError } = await admin
      .from('offers')
      .insert({ product_id: product.id, buyer_id: profile.id, seller_id: product.seller_id, amount: roundedAmount, message: message || null })
      .select('id, amount, message, status, created_at')
      .single();

    if (insertError) {
      if (insertError.code === '23505') return NextResponse.json({ error: 'You already have an offer pending on this item' }, { status: 409 });
      throw insertError;
    }

    const money = `Rs. ${roundedAmount.toLocaleString()}`;
    await notify(product.seller_id, {
      type: 'OFFER_UPDATE',
      title: `New offer: ${money} for "${product.title}"`,
      body: `${profile.full_name ?? 'A buyer'} offered ${money} for "${product.title}"${message ? ` — "${message}"` : ''}. The asking price is Rs. ${Number(product.price).toLocaleString()}.`,
      actionUrl: '/offers',
      email: { subject: `New offer on "${product.title}"`, cta: 'Review the offer' },
    });

    return NextResponse.json({ success: true, offer: created }, { status: 201 });
  } catch (err) {
    console.error('[API] offers POST', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/offers?role=buyer|seller&status=PENDING — my sent offers, or offers received on my listings
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const user = await getFastUser(supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin.from('profiles').select('id').eq('auth_user_id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const sp = new URL(request.url).searchParams;
    const role = sp.get('role') === 'seller' ? 'seller' : 'buyer';
    const status = sp.get('status');

    let query = admin
      .from('offers')
      .select(`
        id, amount, message, counter_amount, counter_message, status, expires_at, order_id, created_at, responded_at,
        product:products(id, title, price, status, is_negotiable, product_images(storage_path, is_primary)),
        buyer:profiles!offers_buyer_id_fkey(id, full_name, profile_photo),
        seller:profiles!offers_seller_id_fkey(id, full_name, profile_photo)
      `)
      .eq(role === 'seller' ? 'seller_id' : 'buyer_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ offers: data ?? [], myProfileId: profile.id });
  } catch (err) {
    console.error('[API] offers GET', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
