import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit, LIMITS } from '@/lib/security/rateLimit';
import { notify } from '@/lib/notify';
import { checkOfferAmount, OFFER_ACCEPT_WINDOW_MS, round2 } from '@/lib/offers';

const schema = z.object({
  action: z.enum(['accept', 'reject', 'counter', 'withdraw']),
  amount: z.number().finite().positive().max(10_000_000).optional(),
  message: z.string().trim().max(300).optional(),
});

const AMOUNT_ERROR: Record<string, string> = {
  TOO_LOW: 'That counter-offer is too low.',
  TOO_HIGH: 'A counter-offer can\'t be more than the asking price.',
};

// POST /api/offers/:id/respond — the SELLER accepts/rejects/counters a PENDING offer, or the BUYER
// accepts/rejects a COUNTERED one. One response each; there is no further back-and-forth after that.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    { const limited = await rateLimit(request, LIMITS.offerRespond, user.id); if (limited) return limited; }

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const { action, message } = parsed.data;

    const admin = createAdminClient();
    const { data: profile } = await admin.from('profiles').select('id, full_name').eq('auth_user_id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const { data: offer } = await admin
      .from('offers')
      .select('id, product_id, buyer_id, seller_id, amount, counter_amount, status, products(title, price)')
      .eq('id', id)
      .maybeSingle();
    if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const product = offer.products as any;
    const title = product?.title ?? 'the item';
    const isSeller = offer.seller_id === profile.id;
    const isBuyer = offer.buyer_id === profile.id;
    if (!isSeller && !isBuyer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let update: Record<string, unknown>;
    let notifyProfileId: string;
    let notifyPayload: { title: string; body: string };

    // The buyer can always pull back their own offer while it's still live, no matter whose turn it is
    if (isBuyer && action === 'withdraw') {
      if (!['PENDING', 'COUNTERED'].includes(offer.status)) return NextResponse.json({ error: 'This offer is no longer open' }, { status: 409 });
      const { data: claimed, error: updateError } = await admin
        .from('offers')
        .update({ status: 'WITHDRAWN', responded_at: new Date().toISOString() })
        .eq('id', offer.id)
        .eq('status', offer.status)
        .select('id, status')
        .single();
      if (updateError || !claimed) return NextResponse.json({ error: 'This offer just changed. Please refresh.' }, { status: 409 });
      await notify(offer.seller_id, { type: 'OFFER_UPDATE', title: 'An offer was withdrawn', body: `The buyer withdrew their offer on "${title}".`, actionUrl: '/offers' });
      return NextResponse.json({ success: true, offer: claimed });
    }
    if (action === 'withdraw') return NextResponse.json({ error: 'Only the buyer can withdraw an offer' }, { status: 403 });

    if (isSeller) {
      if (offer.status !== 'PENDING') return NextResponse.json({ error: 'This offer has already been answered' }, { status: 409 });

      if (action === 'accept') {
        update = { status: 'ACCEPTED', expires_at: new Date(Date.now() + OFFER_ACCEPT_WINDOW_MS).toISOString(), responded_at: new Date().toISOString() };
        notifyProfileId = offer.buyer_id;
        notifyPayload = { title: `Your offer was accepted!`, body: `The seller accepted your offer of Rs. ${Number(offer.amount).toLocaleString()} for "${title}". Add it to your cart and check out within 48 hours.` };
      } else if (action === 'reject') {
        update = { status: 'REJECTED', counter_message: message || null, responded_at: new Date().toISOString() };
        notifyProfileId = offer.buyer_id;
        notifyPayload = { title: `Your offer was declined`, body: `The seller declined your offer of Rs. ${Number(offer.amount).toLocaleString()} for "${title}"${message ? `: "${message}"` : '.'}` };
      } else {
        if (!parsed.data.amount) return NextResponse.json({ error: 'Enter a counter amount' }, { status: 400 });
        const counterAmount = round2(parsed.data.amount);
        const amountError = checkOfferAmount(counterAmount, Number(product?.price ?? offer.amount));
        if (amountError) return NextResponse.json({ error: AMOUNT_ERROR[amountError] }, { status: 400 });
        update = { status: 'COUNTERED', counter_amount: counterAmount, counter_message: message || null, responded_at: new Date().toISOString() };
        notifyProfileId = offer.buyer_id;
        notifyPayload = { title: `The seller countered your offer`, body: `For "${title}" the seller proposed Rs. ${counterAmount.toLocaleString()} instead of your Rs. ${Number(offer.amount).toLocaleString()}${message ? `: "${message}"` : '.'}` };
      }
    } else {
      if (offer.status !== 'COUNTERED') return NextResponse.json({ error: 'There is nothing to respond to on this offer' }, { status: 409 });
      if (action === 'counter') return NextResponse.json({ error: 'You can accept or decline the seller\'s counter-offer' }, { status: 400 });

      const counterAmount = Number(offer.counter_amount ?? offer.amount);

      if (action === 'accept') {
        update = { status: 'ACCEPTED', amount: counterAmount, expires_at: new Date(Date.now() + OFFER_ACCEPT_WINDOW_MS).toISOString(), responded_at: new Date().toISOString() };
        notifyProfileId = offer.seller_id;
        notifyPayload = { title: `Offer accepted`, body: `The buyer accepted your counter of Rs. ${counterAmount.toLocaleString()} for "${title}". They can now check out at that price.` };
      } else {
        update = { status: 'REJECTED', responded_at: new Date().toISOString() };
        notifyProfileId = offer.seller_id;
        notifyPayload = { title: `Counter-offer declined`, body: `The buyer declined your counter of Rs. ${counterAmount.toLocaleString()} for "${title}".` };
      }
    }

    // Claim the offer first: an UPDATE scoped to the status we read, so two responses can't both apply
    const { data: claimed, error: updateError } = await admin
      .from('offers')
      .update(update)
      .eq('id', offer.id)
      .eq('status', offer.status)
      .select('id, amount, status, expires_at')
      .single();
    if (updateError || !claimed) return NextResponse.json({ error: 'This offer just changed. Please refresh.' }, { status: 409 });

    await notify(notifyProfileId, {
      type: 'OFFER_UPDATE',
      ...notifyPayload,
      actionUrl: '/offers',
      email: { subject: notifyPayload.title, cta: 'View the offer' },
    });

    return NextResponse.json({ success: true, offer: claimed });
  } catch (err) {
    console.error('[API] offer respond', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
