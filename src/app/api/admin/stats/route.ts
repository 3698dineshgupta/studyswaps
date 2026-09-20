import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { cached } from '@/lib/cache';

// GET /api/admin/stats — the numbers on the admin dashboard (what needs attention + how the business is doing)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, ['MODERATOR', 'SUPPORT_AGENT', 'FINANCE_ADMIN', 'LOGISTICS_ADMIN', 'VERIFICATION_REVIEWER']);
    if (auth.error) return auth.error;
    const { admin } = auth.ctx;

    const count = async (table: string, f: (q: ReturnType<typeof admin.from>) => unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = admin.from(table).select('id', { count: 'exact', head: true }) as any;
      return ((await f(q)) as { count: number | null }).count ?? 0;
    };
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();

    // Everything independent runs at the same time (one round trip of waiting, not four); the numbers are cached 15 s
    const payload = await cached('admin:stats', 15_000, async () => {
    const paysP = admin.from('payments').select('amount, order_id').eq('status', 'CONFIRMED').gte('created_at', new Date(Date.now() - 30 * 86400_000).toISOString());
    const recentP = admin.from('audit_logs').select('id, action, entity_type, actor_email, created_at').order('created_at', { ascending: false }).limit(8);
    const [[pendingListings, pendingVerifications, openDisputes, pendingWithdrawals, paidOrders, activeListings, users, newUsers7d, ordersToday], { data: pays }, { data: recent }] = await Promise.all([Promise.all([
      count('products', (q) => (q as any).eq('status', 'PENDING_REVIEW')), // eslint-disable-line @typescript-eslint/no-explicit-any
      count('verification_requests', (q) => (q as any).in('status', ['PENDING', 'UNDER_REVIEW'])), // eslint-disable-line @typescript-eslint/no-explicit-any
      count('disputes', (q) => (q as any).in('status', ['OPEN', 'UNDER_REVIEW'])), // eslint-disable-line @typescript-eslint/no-explicit-any
      count('withdrawals', (q) => (q as any).in('status', ['REQUESTED', 'PROCESSING'])), // eslint-disable-line @typescript-eslint/no-explicit-any
      count('orders', (q) => (q as any).in('status', ['PAYMENT_CONFIRMED', 'SELLER_NOTIFIED', 'SELLER_ACCEPTED', 'PACKING', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'])), // eslint-disable-line @typescript-eslint/no-explicit-any
      count('products', (q) => (q as any).eq('status', 'ACTIVE')), // eslint-disable-line @typescript-eslint/no-explicit-any
      count('profiles', (q) => q),
      count('profiles', (q) => (q as any).gte('created_at', since)), // eslint-disable-line @typescript-eslint/no-explicit-any
      count('orders', (q) => (q as any).gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()).neq('status', 'CREATED')), // eslint-disable-line @typescript-eslint/no-explicit-any
    ]), paysP, recentP]);

    // Money: confirmed payments in the last 30 days, and StudentMarket's share (platform fee + delivery + 5% commission)
    const gross = (pays ?? []).reduce((s, p) => s + Number(p.amount), 0);
    const ids = (pays ?? []).map((p) => p.order_id);
    let ours = 0;
    if (ids.length) {
      const { data: os } = await admin.from('orders').select('subtotal, delivery_charge, platform_fee').in('id', ids);
      ours = (os ?? []).reduce((s, o) => s + Number(o.platform_fee ?? 0) + Number(o.delivery_charge ?? 0) + Number(o.subtotal ?? 0) * 0.05, 0);
    }

    return {
      attention: { pendingListings, pendingVerifications, openDisputes, pendingWithdrawals, ordersInProgress: paidOrders },
      totals: { activeListings, users, newUsers7d, ordersToday, gross30d: Math.round(gross), platformShare30d: Math.round(ours) },
      recent: recent ?? [],
    };
    });
    return NextResponse.json(payload);
  } catch (err) {
    console.error('[API] admin stats', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
