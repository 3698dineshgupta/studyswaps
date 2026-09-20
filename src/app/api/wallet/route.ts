import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { releaseDateFor, releaseDueFunds } from '@/lib/wallet/release';
import { commissionFor, WITHDRAWAL } from '@/lib/pricing';

/* eslint-disable @typescript-eslint/no-explicit-any */

// GET /api/wallet — the seller's balances, what's still being held (and when it unlocks), history and payout rules
export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('id, verification_status, account_status')
      .eq('auth_user_id', user.id)
      .single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    // Unlock anything that has reached its release date before showing balances
    await releaseDueFunds(admin, profile.id);

    const { data: wallet } = await admin
      .from('wallets')
      .select('id, available_balance, pending_balance, total_earned, total_withdrawn')
      .eq('seller_id', profile.id)
      .maybeSingle();

    const [{ data: ledger }, { data: withdrawals }, { data: heldOrders }] = await Promise.all([
      admin.from('wallet_ledger').select('id, transaction_type, amount, reference, description, created_at').eq('seller_id', profile.id).order('created_at', { ascending: false }).limit(30),
      admin.from('withdrawals').select('id, amount, status, payout_method, payout_details, failure_reason, created_at, processed_at').eq('seller_id', profile.id).order('created_at', { ascending: false }).limit(10),
      // Paid orders whose earnings are still held
      admin
        .from('orders')
        .select('id, order_number, status, subtotal, order_items(title), deliveries(delivery_events(status, created_at))')
        .eq('seller_id', profile.id)
        .in('status', ['PAYMENT_CONFIRMED', 'SELLER_NOTIFIED', 'SELLER_ACCEPTED', 'PACKING', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'])
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const held = ((heldOrders ?? []) as any[]).map((o) => {
      const events: any[] = (Array.isArray(o.deliveries) ? o.deliveries[0] : o.deliveries)?.delivery_events ?? [];
      const deliveredAt = events.find((e) => e.status === 'DELIVERED')?.created_at;
      const subtotal = Number(o.subtotal);
      return {
        id: o.id,
        orderNumber: o.order_number,
        title: o.order_items?.[0]?.title ?? 'Order',
        gross: subtotal,
        commission: commissionFor(subtotal),
        net: Math.round((subtotal - commissionFor(subtotal)) * 100) / 100,
        stage: o.status === 'DELIVERED' ? 'awaiting_confirmation' : 'awaiting_delivery',
        releaseOn: deliveredAt ? releaseDateFor(deliveredAt).toISOString() : null,
      };
    });

    const openWithdrawal = (withdrawals ?? []).find((w: any) => ['REQUESTED', 'PROCESSING'].includes(w.status)) ?? null;
    const available = Number(wallet?.available_balance ?? 0);

    // Everything the UI needs to tell the seller exactly whether they can withdraw right now, and why not
    const blockers: string[] = [];
    if (profile.verification_status !== 'VERIFIED') blockers.push('Your student identity must be verified.');
    if (profile.account_status !== 'ACTIVE') blockers.push('Your account must be active.');
    if (openWithdrawal) blockers.push('You already have a withdrawal in progress.');
    if (available < WITHDRAWAL.minAmount) blockers.push(`You need at least Rs. ${WITHDRAWAL.minAmount} available (you have Rs. ${available}).`);

    return NextResponse.json({
      wallet: wallet ?? null,
      ledger: ledger ?? [],
      withdrawals: withdrawals ?? [],
      held,
      canWithdraw: blockers.length === 0,
      blockers,
      rules: WITHDRAWAL,
    });
  } catch (err) {
    console.error('[API] wallet GET error:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
