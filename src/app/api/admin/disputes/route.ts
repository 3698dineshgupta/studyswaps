import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, audit, pageParam } from '@/lib/admin/guard';
import { adminSetOrderStatus } from '@/lib/admin/orders';
import { notify } from '@/lib/notify';

const ROLES = ['SUPPORT_AGENT', 'FINANCE_ADMIN'] as const;
const STATUSES = ['OPEN', 'UNDER_REVIEW', 'WAITING_FOR_BUYER', 'WAITING_FOR_SELLER', 'RESOLVED', 'REJECTED', 'REFUNDED'];

// GET /api/admin/disputes?status=OPEN&page=
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, [...ROLES]);
    if (auth.error) return auth.error;
    const { admin } = auth.ctx;

    const sp = new URL(request.url).searchParams;
    const page = pageParam(sp.get('page'));
    const size = 15;
    const status = STATUSES.includes(sp.get('status') || '') ? sp.get('status')! : 'OPEN';
    const { data, count, error } = await admin
      .from('disputes')
      .select(`id, reason, description, status, resolution, refund_amount, created_at, resolved_at, order_id,
        opener:profiles!disputes_opened_by_fkey(id, full_name),
        orders(order_number, total, status, buyer_id, seller_id)`, { count: 'exact' })
      .eq('status', status)
      .order('created_at', { ascending: true })
      .range((page - 1) * size, page * size - 1);
    if (error) throw error;

    const counts: Record<string, number> = {};
    await Promise.all(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REFUNDED', 'REJECTED'].map(async (s) => { counts[s] = (await admin.from('disputes').select('id', { count: 'exact', head: true }).eq('status', s)).count ?? 0; }));
    return NextResponse.json({ disputes: data ?? [], total: count ?? 0, counts });
  } catch (err) {
    console.error('[API] admin disputes GET', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const schema = z.object({
  id: z.string().uuid(),
  action: z.enum(['review', 'resolve', 'reject', 'refund']),
  resolution: z.string().trim().max(1000).optional(),
}).strict();

// POST /api/admin/disputes — take a dispute forward. "refund" also refunds the order and takes the seller's earnings back.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, [...ROLES]);
    if (auth.error) return auth.error;
    const { ctx } = auth;
    const { admin, profile } = ctx;

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const { id, action, resolution } = parsed.data;
    if (action !== 'review' && (!resolution || resolution.length < 5)) return NextResponse.json({ error: 'Write the decision so both people can read it (5+ characters)' }, { status: 400 });

    const { data: d } = await admin.from('disputes').select('id, status, order_id, opened_by, orders(order_number, total, buyer_id, seller_id)').eq('id', id).maybeSingle();
    if (!d) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
    if (['RESOLVED', 'REJECTED', 'REFUNDED'].includes(d.status)) return NextResponse.json({ error: 'This dispute is already closed' }, { status: 409 });
    const order = (Array.isArray(d.orders) ? d.orders[0] : d.orders) as { order_number: string; total: number; buyer_id: string; seller_id: string } | null;

    let next = 'UNDER_REVIEW';
    let refundAmount: number | null = null;
    if (action === 'resolve') next = 'RESOLVED';
    if (action === 'reject') next = 'REJECTED';
    if (action === 'refund') {
      const r = await adminSetOrderStatus(ctx, d.order_id, 'REFUNDED', resolution);
      // Refunding an order that is already refunded/cancelled is fine for the dispute; other failures stop here
      if (!r.ok && r.code !== 409) return NextResponse.json({ error: r.error }, { status: r.code });
      next = 'REFUNDED';
      refundAmount = Number(order?.total ?? 0);
    }

    await admin.from('disputes').update({
      status: next,
      ...(action !== 'review' ? { resolution, resolved_by: profile.id, resolved_at: new Date().toISOString() } : {}),
      ...(refundAmount !== null ? { refund_amount: refundAmount } : {}),
    }).eq('id', id);
    await audit(ctx, request, `DISPUTE_${action.toUpperCase()}`, 'dispute', id, { resolution: resolution ?? null, refundAmount }, { status: d.status });

    if (order) {
      const msg = action === 'review' ? 'We are looking into your dispute.' : `Decision: ${resolution}`;
      await Promise.all([order.buyer_id, order.seller_id].map((pid) => notify(pid, { type: 'DISPUTE_UPDATE', title: `Dispute on order ${order.order_number}: ${next.replace('_', ' ').toLowerCase()}`, body: msg, actionUrl: pid === order.buyer_id ? `/orders/${d.order_id}` : '/dashboard/orders' })));
    }
    return NextResponse.json({ success: true, status: next });
  } catch (err) {
    console.error('[API] admin disputes POST', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
