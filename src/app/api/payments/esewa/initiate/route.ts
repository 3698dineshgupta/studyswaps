import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ESewaService } from '@/lib/esewa/service';
import { APP_URL } from '@/lib/constants';
import { rateLimit, LIMITS } from '@/lib/security/rateLimit';

const initiateSchema = z.object({
  orderId: z.string().uuid(),
});

// POST /api/payments/esewa/initiate — returns signed form fields for eSewa
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    { const limited = await rateLimit(request, LIMITS.payment, user.id); if (limited) return limited; }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const parsed = initiateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    // RLS already limits this to the buyer's/seller's orders; still check ownership
    const { data: order } = await supabase
      .from('orders')
      .select('id, order_number, status, subtotal, delivery_charge, platform_fee, total, buyer_id')
      .eq('id', parsed.data.orderId)
      .single();

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.buyer_id !== profile.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!['CREATED', 'PAYMENT_PENDING'].includes(order.status)) {
      return NextResponse.json({ error: 'Order is not awaiting payment' }, { status: 409 });
    }

    // Payment writes are server-only (no RLS write policies) — use the service role
    const admin = createAdminClient();

    // Reuse an open payment attempt so retries don't create duplicates
    const { data: existing } = await admin
      .from('payments')
      .select('id, esewa_transaction_uuid')
      .eq('order_id', order.id)
      .eq('method', 'ESEWA')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let transactionUuid = existing?.esewa_transaction_uuid as string | undefined;

    if (!transactionUuid) {
      // eSewa only accepts alphanumerics and hyphens in transaction_uuid
      transactionUuid = `${order.order_number}-${Date.now()}`;

      const { error: paymentError } = await admin.from('payments').insert({
        order_id: order.id,
        method: 'ESEWA',
        status: 'PENDING',
        amount: order.total,
        esewa_transaction_uuid: transactionUuid,
        esewa_product_code: process.env.ESEWA_PRODUCT_CODE || 'EPAYTEST',
      });

      if (paymentError) throw paymentError;

      await admin.from('orders').update({ status: 'PAYMENT_PENDING' }).eq('id', order.id);
    }

    const payment = ESewaService.generatePaymentForm({
      amount: Number(order.subtotal),
      serviceCharge: Number(order.platform_fee ?? 0),
      deliveryCharge: Number(order.delivery_charge ?? 0),
      transactionUuid,
      // eSewa appends `?data=...` itself, so these must not carry a query string
      successUrl: `${APP_URL}/api/payments/esewa/verify`,
      failureUrl: `${APP_URL}/orders/${order.id}`,
    });

    return NextResponse.json({ success: true, payment });
  } catch (error) {
    console.error('[API] eSewa initiate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
