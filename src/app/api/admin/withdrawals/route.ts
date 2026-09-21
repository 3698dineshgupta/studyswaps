import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, audit, pageParam } from '@/lib/admin/guard';
import { notify } from '@/lib/notify';
import { TelegramService } from '@/lib/telegram/service';

const ROLES = ['FINANCE_ADMIN'] as const;
const STATUSES = ['REQUESTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'];

// GET /api/admin/withdrawals?status=REQUESTED&page=
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, [...ROLES]);
    if (auth.error) return auth.error;
    const { admin } = auth.ctx;

    const sp = new URL(request.url).searchParams;
    const page = pageParam(sp.get('page'));
    const size = 20;
    const status = STATUSES.includes(sp.get('status') || '') ? sp.get('status')! : 'REQUESTED';
    const { data, count, error } = await admin
      .from('withdrawals')
      .select('id, amount, status, payout_method, payout_details, admin_notes, failure_reason, created_at, processed_at, seller:profiles!withdrawals_seller_id_fkey(id, full_name, phone)', { count: 'exact' })
      .eq('status', status)
      .order('created_at', { ascending: status === 'REQUESTED' || status === 'PROCESSING' })
      .range((page - 1) * size, page * size - 1);
    if (error) throw error;

    const counts: Record<string, number> = {};
    await Promise.all(STATUSES.map(async (s) => { counts[s] = (await admin.from('withdrawals').select('id', { count: 'exact', head: true }).eq('status', s)).count ?? 0; }));
    return NextResponse.json({ withdrawals: data ?? [], total: count ?? 0, counts });
  } catch (err) {
    console.error('[API] admin withdrawals GET', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const schema = z.object({
  id: z.string().uuid(),
  action: z.enum(['processing', 'paid', 'reject']),
  reference: z.string().trim().max(120).optional(),
  reason: z.string().trim().max(300).optional(),
}).strict();

// POST /api/admin/withdrawals — start processing, mark as paid (eSewa reference), or reject and return the money
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, [...ROLES]);
    if (auth.error) return auth.error;
    const { ctx } = auth;
    const { admin, profile } = ctx;

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const { id, action, reference, reason } = parsed.data;
    if (action === 'paid' && (!reference || reference.length < 3)) return NextResponse.json({ error: 'Enter the eSewa transaction reference' }, { status: 400 });
    if (action === 'reject' && (!reason || reason.length < 3)) return NextResponse.json({ error: 'Give the seller a reason' }, { status: 400 });

    const { data: wd } = await admin.from('withdrawals').select('id, amount, status, seller_id, payout_details').eq('id', id).maybeSingle();
    if (!wd) return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 });
    if (!['REQUESTED', 'PROCESSING'].includes(wd.status)) return NextResponse.json({ error: 'This withdrawal is already finished' }, { status: 409 });

    const money = `Rs. ${Number(wd.amount).toLocaleString()}`;
    if (action === 'processing') {
      await admin.from('withdrawals').update({ status: 'PROCESSING', processed_by: profile.id }).eq('id', id).eq('status', 'REQUESTED');
      await audit(ctx, request, 'WITHDRAWAL_PROCESSING', 'withdrawal', id, {});
      await notify(wd.seller_id, { type: 'WITHDRAWAL_UPDATE', title: 'Your withdrawal is being processed', body: `${money} is being sent to your eSewa.`, actionUrl: '/dashboard/wallet', email: { subject: 'Your withdrawal is being processed', cta: 'Open my wallet' } });
      return NextResponse.json({ success: true, status: 'PROCESSING' });
    }

    // Atomic in the database: pays out, or returns the money to the seller's balance
    const { data: done, error } = await admin.rpc('finish_withdrawal', { p_withdrawal_id: id, p_succeeded: action === 'paid', p_admin_id: profile.id, p_note: action === 'paid' ? reference : reason });
    if (error) return NextResponse.json({ error: 'Could not update the wallet. Run migration 009 in Supabase.' }, { status: 500 });
    if (!done) return NextResponse.json({ error: 'This withdrawal is already finished' }, { status: 409 });

    await audit(ctx, request, action === 'paid' ? 'WITHDRAWAL_PAID' : 'WITHDRAWAL_REJECTED', 'withdrawal', id, { reference: reference ?? null, reason: reason ?? null, amount: wd.amount });
    await notify(wd.seller_id, action === 'paid'
      ? { type: 'WITHDRAWAL_UPDATE', title: `${money} sent to your eSewa`, body: `Your withdrawal was paid. eSewa reference: ${reference}.`, actionUrl: '/dashboard/wallet', email: { subject: `${money} sent to your eSewa`, cta: 'Open my wallet' } }
      : { type: 'WITHDRAWAL_UPDATE', title: 'Withdrawal not paid', body: `We couldn't pay ${money}: ${reason}. The money is back in your available balance.`, actionUrl: '/dashboard/wallet', email: { subject: 'Your withdrawal was not paid', cta: 'Open my wallet' } });
    TelegramService.sendAdminNotification(`WITHDRAWAL ${action === 'paid' ? 'PAID' : 'REJECTED'}\nAmount: ${money}\n${action === 'paid' ? `Ref: ${reference}` : `Reason: ${reason}`}\nBy: ${profile.full_name ?? 'admin'}`).catch(() => {});
    return NextResponse.json({ success: true, status: action === 'paid' ? 'COMPLETED' : 'FAILED' });
  } catch (err) {
    console.error('[API] admin withdrawals POST', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
