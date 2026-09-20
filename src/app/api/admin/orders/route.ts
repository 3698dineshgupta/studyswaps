import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, audit, cleanSearch, pageParam } from '@/lib/admin/guard';
import { ADMIN_SETTABLE, adminSetOrderStatus } from '@/lib/admin/orders';

const ROLES = ['SUPPORT_AGENT', 'LOGISTICS_ADMIN', 'FINANCE_ADMIN'] as const;
const ORDER_STATUSES = ['CREATED', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'SELLER_NOTIFIED', 'SELLER_ACCEPTED', 'PACKING', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'BUYER_CONFIRMED', 'COMPLETED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURNED', 'REFUNDED', 'DISPUTED'];

// GET /api/admin/orders?status=&search=&page=  — every order, with the addresses the delivery team needs
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, [...ROLES]);
    if (auth.error) return auth.error;
    const { admin } = auth.ctx;

    const sp = new URL(request.url).searchParams;
    const page = pageParam(sp.get('page'));
    const size = 15;
    const status = ORDER_STATUSES.includes(sp.get('status') || '') ? sp.get('status')! : '';
    const search = cleanSearch(sp.get('search'), 40);

    let q = admin
      .from('orders')
      .select(`id, order_number, status, subtotal, delivery_charge, platform_fee, total, delivery_address, meeting_location, created_at,
        buyer:profiles!orders_buyer_id_fkey(id, full_name, phone),
        seller:profiles!orders_seller_id_fkey(id, full_name, phone),
        order_items(id, title, quantity, price),
        payments(id, status, amount, transaction_id, created_at)`, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * size, page * size - 1);
    if (status) q = q.eq('status', status);
    else q = q.not('status', 'in', '(CREATED)'); // hide never-started checkouts unless asked for
    if (search) q = q.ilike('order_number', `%${search}%`);
    const { data, count, error } = await q;
    if (error) throw error;
    return NextResponse.json({ orders: data ?? [], total: count ?? 0, settable: ADMIN_SETTABLE });
  } catch (err) {
    console.error('[API] admin orders GET', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const schema = z.object({
  id: z.string().uuid(),
  status: z.enum(ADMIN_SETTABLE),
  note: z.string().trim().max(300).optional(),
}).strict();

// POST /api/admin/orders — move an order to another stage (cancel, refund, mark delivered …). Audited.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, [...ROLES]);
    if (auth.error) return auth.error;
    const { ctx } = auth;

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const { id, status, note } = parsed.data;

    // Money-moving stages need a finance-capable role
    if (['REFUNDED', 'CANCELLED', 'RETURNED'].includes(status) && !ctx.roles.some((r) => ['SUPER_ADMIN', 'ADMIN', 'FINANCE_ADMIN', 'SUPPORT_AGENT'].includes(r))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const r = await adminSetOrderStatus(ctx, id, status, note);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.code });
    await audit(ctx, request, 'ADMIN_ORDER_STATUS', 'order', id, { to: status, note: note ?? null, refundNeeded: r.refundNeeded }, { status: r.from });
    return NextResponse.json({ success: true, refundNeeded: r.refundNeeded });
  } catch (err) {
    console.error('[API] admin orders POST', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
