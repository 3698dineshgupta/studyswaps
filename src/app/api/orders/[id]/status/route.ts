import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { TelegramService } from '@/lib/telegram/service';
import { releaseOrderFunds } from '@/lib/wallet/release';
import { notify } from '@/lib/notify';
import { WITHDRAWAL } from '@/lib/pricing';
import { rateLimit, LIMITS } from '@/lib/security/rateLimit';

const updateStatusSchema = z.object({
  status: z.enum([
    'SELLER_ACCEPTED', 'PACKING', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT',
    'OUT_FOR_DELIVERY', 'DELIVERED', 'BUYER_CONFIRMED', 'CANCELLED', 'RETURN_REQUESTED',
  ]),
  note: z.string().max(500).optional(),
});

// Valid transitions: who can make them
const VALID_TRANSITIONS: Record<string, { from: string[]; role: 'buyer' | 'seller' | 'both' }> = {
  SELLER_ACCEPTED: { from: ['SELLER_NOTIFIED', 'PAYMENT_CONFIRMED'], role: 'seller' },
  PACKING: { from: ['SELLER_ACCEPTED'], role: 'seller' },
  READY_FOR_PICKUP: { from: ['PACKING'], role: 'seller' },
  PICKED_UP: { from: ['READY_FOR_PICKUP'], role: 'seller' },
  IN_TRANSIT: { from: ['PICKED_UP'], role: 'seller' },
  OUT_FOR_DELIVERY: { from: ['IN_TRANSIT'], role: 'seller' },
  DELIVERED: { from: ['OUT_FOR_DELIVERY', 'READY_FOR_PICKUP'], role: 'seller' },
  BUYER_CONFIRMED: { from: ['DELIVERED'], role: 'buyer' },
  CANCELLED: { from: ['CREATED', 'PAYMENT_PENDING', 'SELLER_NOTIFIED', 'SELLER_ACCEPTED'], role: 'both' },
  RETURN_REQUESTED: { from: ['DELIVERED', 'BUYER_CONFIRMED'], role: 'buyer' },
};

const DESCRIPTIONS: Record<string, string> = {
  SELLER_ACCEPTED: 'Seller has accepted your order',
  PACKING: 'Seller is packing your order',
  READY_FOR_PICKUP: 'Order is ready for pickup',
  PICKED_UP: 'Order has been picked up',
  IN_TRANSIT: 'Order is in transit',
  OUT_FOR_DELIVERY: 'Order is out for delivery',
  DELIVERED: 'Order has been delivered',
  BUYER_CONFIRMED: 'Buyer confirmed receipt',
  CANCELLED: 'Order has been cancelled',
  RETURN_REQUESTED: 'Buyer requested a return',
};

// POST /api/orders/[id]/status — advance an order (buyer or seller, per the table above)
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    { const limited = await rateLimit(request, LIMITS.orderStatus, user.id); if (limited) return limited; }

    const { data: profile } = await supabase.from('profiles').select('id, full_name').eq('auth_user_id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const parsed = updateStatusSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    const { status: newStatus, note } = parsed.data;

    // Order writes are server-only (RLS has no update policy for users), so use the service role
    const admin = createAdminClient();

    const { data: order } = await admin
      .from('orders')
      .select('id, order_number, status, buyer_id, seller_id')
      .eq('id', params.id)
      .single();
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const isBuyer = order.buyer_id === profile.id;
    const isSeller = order.seller_id === profile.id;
    if (!isBuyer && !isSeller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const transition = VALID_TRANSITIONS[newStatus];
    if (!transition.from.includes(order.status)) {
      return NextResponse.json({ error: `Cannot change from ${order.status} to ${newStatus}` }, { status: 409 });
    }
    if (transition.role === 'buyer' && !isBuyer) return NextResponse.json({ error: 'Only the buyer can do this' }, { status: 403 });
    if (transition.role === 'seller' && !isSeller) return NextResponse.json({ error: 'Only the seller can do this' }, { status: 403 });

    // Compare-and-set so two requests can't both move the same order
    const { data: moved, error: updateError } = await admin
      .from('orders')
      .update({ status: newStatus, ...(newStatus === 'CANCELLED' ? { cancelled_by: profile.id, cancelled_at: new Date().toISOString() } : {}) })
      .eq('id', params.id)
      .eq('status', order.status)
      .select('id');
    if (updateError) throw updateError;
    if (!moved?.length) return NextResponse.json({ error: 'This order was just updated. Please refresh.' }, { status: 409 });

    const { data: delivery } = await admin
      .from('deliveries')
      .update({ current_status: newStatus, ...(newStatus === 'DELIVERED' ? { actual_delivery: new Date().toISOString() } : {}) })
      .eq('order_id', params.id)
      .select('id')
      .maybeSingle();

    if (delivery) {
      await admin.from('delivery_events').insert({
        delivery_id: delivery.id,
        status: newStatus,
        description: note || DESCRIPTIONS[newStatus] || newStatus,
        actor_id: profile.id,
        actor_type: isBuyer ? 'buyer' : 'seller',
      });
    }

    // Money: buyer confirming receipt releases the seller's held earnings straight away
    let released: number | undefined;
    if (newStatus === 'BUYER_CONFIRMED') {
      const r = await releaseOrderFunds(admin, params.id);
      if (r.released) released = r.amount;
      else if (r.reason === 'rpc_failed') {
        await admin.from('audit_logs').insert({ actor_id: profile.id, action: 'WALLET_RELEASE_FAILED', entity_type: 'order', entity_id: params.id });
      }
    }

    // Tell the other party what happened
    const other = isBuyer ? order.seller_id : order.buyer_id;
    const link = isBuyer ? '/dashboard/orders' : `/orders/${params.id}`;
    const extra = newStatus === 'DELIVERED' ? ` Please confirm receipt — if you don't, the seller is paid automatically after ${WITHDRAWAL.releaseDays} days.` : '';
    await notify(other, {
      type: newStatus === 'DELIVERED' || newStatus === 'OUT_FOR_DELIVERY' ? 'DELIVERY_UPDATE' : 'ORDER_UPDATE',
      title: `Order ${order.order_number}: ${(DESCRIPTIONS[newStatus] ?? newStatus).replace(/^(Seller|Buyer|Order) (has |is )?/i, '')}`,
      body: `${DESCRIPTIONS[newStatus] ?? newStatus}.${extra}`,
      actionUrl: link,
    });

    await admin.from('audit_logs').insert({
      actor_id: profile.id,
      actor_email: user.email,
      action: 'ORDER_STATUS_CHANGED',
      entity_type: 'order',
      entity_id: params.id,
      new_data: { from: order.status, to: newStatus, actor: isBuyer ? 'buyer' : 'seller' },
    });

    TelegramService.sendAdminNotification(`📦 ORDER UPDATE\n\nOrder: ${order.order_number}\nStatus: ${order.status} → ${newStatus}\nBy: ${profile.full_name}`)
      .catch((e) => console.error('[Telegram] Order status notification failed:', e));

    return NextResponse.json({ success: true, orderId: params.id, newStatus, released });
  } catch (error) {
    console.error('[API] Order status update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
