import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ESewaService } from '@/lib/esewa/service';
import { TelegramService } from '@/lib/telegram/service';
import { APP_URL } from '@/lib/constants';
import { notify } from '@/lib/notify';
import { commissionFor, SELLER_COMMISSION_RATE } from '@/lib/pricing';
import { logSecurity } from '@/lib/security/log';

function redirectTo(path: string) {
  return NextResponse.redirect(`${APP_URL}${path}`);
}

// GET — eSewa redirects the buyer here after payment with ?data=<base64 JSON>.
// The redirect is never trusted on its own: signature, amount and eSewa's own
// status API must all agree before the order is marked paid.
// Serverless hosts (Vercel) stop a function after 10 s by default; uploads and payment checks may need longer
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const encoded = new URL(request.url).searchParams.get('data');
  if (!encoded) return redirectTo('/orders?error=invalid_callback');

  const callback = ESewaService.decodeCallbackData(encoded);
  if (!callback) return redirectTo('/orders?error=invalid_callback');

  const admin = createAdminClient();

  try {
    if (!ESewaService.verifySignature(callback)) {
      console.error('[eSewa] Invalid signature for transaction:', callback.transaction_uuid);
      await admin.from('audit_logs').insert({
        action: 'PAYMENT_SIGNATURE_INVALID',
        entity_type: 'payment',
        new_data: { transaction_uuid: callback.transaction_uuid },
      });
      return redirectTo('/orders?error=invalid_signature');
    }

    const { data: payment } = await admin
      .from('payments')
      .select('id, order_id, status, amount')
      .eq('esewa_transaction_uuid', callback.transaction_uuid)
      .maybeSingle();

    if (!payment) return redirectTo('/orders?error=payment_not_found');

    const orderPath = `/orders/${payment.order_id}`;

    // Idempotent: refreshes / duplicate callbacks just land on the order page
    if (payment.status === 'CONFIRMED') return redirectTo(`${orderPath}?payment=success`);
    if (payment.status !== 'PENDING') return redirectTo(`${orderPath}?payment=failed`);

    const { data: order } = await admin
      .from('orders')
      .select('id, order_number, subtotal, total, seller_id, buyer_id')
      .eq('id', payment.order_id)
      .single();

    if (!order) return redirectTo('/orders?error=order_not_found');

    // Amount in the callback must match what we charged
    const callbackAmount = parseFloat(String(callback.total_amount).replace(/,/g, ''));
    if (Math.abs(callbackAmount - Number(order.total)) > 0.01) {
      await admin
        .from('payments')
        .update({
          status: 'FAILED',
          gateway_response: { reason: 'amount_mismatch', callback },
        })
        .eq('id', payment.id)
        .eq('status', 'PENDING');
      await admin.from('audit_logs').insert({
        action: 'PAYMENT_AMOUNT_MISMATCH',
        entity_type: 'payment',
        entity_id: payment.id,
        new_data: { expected: order.total, received: callbackAmount },
      });
      return redirectTo(`${orderPath}?payment=failed`);
    }

    // Source of truth: ask eSewa directly
    const remote = await ESewaService.checkTransactionStatus({
      transactionUuid: callback.transaction_uuid,
      totalAmount: Number(order.total),
    });

    if (remote.status !== 'COMPLETE') {
      const terminal = ['CANCELED', 'NOT_FOUND', 'FULL_REFUND'].includes(remote.status);
      if (terminal) {
        await admin
          .from('payments')
          .update({ status: 'FAILED', gateway_response: { remote, callback } })
          .eq('id', payment.id)
          .eq('status', 'PENDING');
      }
      return redirectTo(`${orderPath}?payment=failed`);
    }

    // Claim the payment: only one concurrent request can flip PENDING -> CONFIRMED
    const now = new Date().toISOString();
    const { data: claimed, error: claimError } = await admin
      .from('payments')
      .update({
        status: 'CONFIRMED',
        transaction_id: callback.transaction_code || remote.refId || null,
        esewa_product_code: callback.product_code,
        esewa_signed_field_names: callback.signed_field_names,
        esewa_signature: callback.signature,
        gateway_response: { callback, remote },
        verified_at: now,
        verified_by_server: true,
      })
      .eq('id', payment.id)
      .eq('status', 'PENDING')
      .select('id');

    if (claimError) throw claimError;
    if (!claimed || claimed.length === 0) {
      return redirectTo(`${orderPath}?payment=success`);
    }

    await admin
      .from('orders')
      .update({ status: 'PAYMENT_CONFIRMED' })
      .eq('id', order.id);

    // Reserve the stock ATOMICALLY: each decrement only succeeds if nobody else took the item in between
    // (compare-and-set on the current quantity). Two buyers paying for the last item can't both get it.
    const { data: items } = await admin
      .from('order_items')
      .select('product_id, quantity')
      .eq('order_id', order.id);
    let oversold = false;
    for (const it of items ?? []) {
      const want = Number(it.quantity ?? 1);
      let reserved = false;
      for (let attempt = 0; attempt < 3 && !reserved; attempt++) {
        const { data: prod } = await admin.from('products').select('quantity').eq('id', it.product_id).single();
        const have = Number(prod?.quantity ?? 0);
        if (have < want) break;
        const left = have - want;
        const { data: won } = await admin
          .from('products')
          .update(left === 0 ? { quantity: 0, status: 'SOLD' } : { quantity: left })
          .eq('id', it.product_id)
          .eq('quantity', have)
          .select('id');
        reserved = !!won?.length;
      }
      if (!reserved) { oversold = true; break; }
    }

    if (oversold) {
      // The buyer's money arrived but the item was taken by someone who paid first: cancel and flag for a refund.
      await admin.from('orders').update({ status: 'CANCELLED' }).eq('id', order.id);
      await admin.from('deliveries').update({ current_status: 'CANCELLED' }).eq('order_id', order.id);
      await admin.from('audit_logs').insert({ action: 'PAYMENT_OVERSOLD_REFUND_REQUIRED', entity_type: 'payment', entity_id: payment.id, new_data: { order_number: order.order_number, amount: order.total } });
      logSecurity('payment_oversold', request, { orderId: order.id, paymentId: payment.id });
      await notify(order.buyer_id, { type: 'PAYMENT_UPDATE', title: 'Item no longer available', body: `Sorry — the item in order ${order.order_number} was bought by someone else a moment before your payment cleared. We will refund Rs. ${order.total} to your eSewa.`, actionUrl: `/orders/${order.id}` });
      TelegramService.sendAdminNotification(`OVERSOLD - REFUND REQUIRED
Order: ${order.order_number}
Amount: Rs. ${order.total}
Transaction: ${callback.transaction_code}`).catch(() => {});
      return redirectTo(`${orderPath}?payment=success`);
    }

    // Paid: now (and only now) the bought items leave the buyer's cart
    const { data: buyerCart } = await admin.from('carts').select('id').eq('profile_id', order.buyer_id).maybeSingle();
    if (buyerCart) await admin.from('cart_items').delete().eq('cart_id', buyerCart.id).in('product_id', (items ?? []).map((i) => i.product_id));

    // Delivery timeline
    const { data: delivery } = await admin
      .from('deliveries')
      .update({ current_status: 'PAYMENT_CONFIRMED' })
      .eq('order_id', order.id)
      .select('id')
      .maybeSingle();
    if (delivery) {
      await admin.from('delivery_events').insert({
        delivery_id: delivery.id,
        status: 'PAYMENT_CONFIRMED',
        description: 'Payment confirmed via eSewa',
        actor_type: 'system',
      });
    }

    // Hold the seller's NET earnings (item price minus the 5% commission) until delivery is confirmed.
    // Delivery and platform fees belong to StudySwaps and are never credited to the seller.
    const subtotal = Number(order.subtotal);
    const commission = commissionFor(subtotal);
    const sellerNet = Math.round((subtotal - commission) * 100) / 100;
    const { error: creditError } = await admin.rpc('credit_seller_pending', {
      p_seller_id: order.seller_id,
      p_amount: sellerNet,
      p_order_id: order.id,
    });
    if (creditError) console.error('[eSewa] Seller wallet credit failed:', creditError);
    else {
      await admin
        .from('wallet_ledger')
        .update({
          reference: `Order ${order.order_number}`,
          description: `Sale Rs. ${subtotal} − ${SELLER_COMMISSION_RATE * 100}% StudySwaps fee Rs. ${commission} = Rs. ${sellerNet} (held until delivery is confirmed)`,
        })
        .eq('order_id', order.id)
        .eq('transaction_type', 'SALE_PENDING');
    }

    logSecurity('payment_confirmed', request, { orderId: order.id, paymentId: payment.id });
    await admin.from('audit_logs').insert({
      action: 'PAYMENT_CONFIRMED',
      entity_type: 'payment',
      entity_id: payment.id,
      new_data: {
        order_number: order.order_number,
        transaction_code: callback.transaction_code,
        amount: order.total,
      },
    });

    await Promise.all([
      notify(order.buyer_id, { type: 'PAYMENT_UPDATE', title: 'Payment received', body: `We received your payment for order ${order.order_number}. The seller has been notified.`, actionUrl: `/orders/${order.id}` }),
      notify(order.seller_id, { type: 'ORDER_UPDATE', title: 'New order to prepare', body: `Order ${order.order_number} has been paid. You'll earn Rs. ${sellerNet.toLocaleString()} (after the ${SELLER_COMMISSION_RATE * 100}% fee) once delivery is confirmed. Please get the item ready for handover.`, actionUrl: `/dashboard/orders` }),
    ]);

    TelegramService.sendAdminNotification(
      `PAYMENT CONFIRMED\nOrder: ${order.order_number}\nAmount: Rs. ${order.total}\nTransaction: ${callback.transaction_code}`
    ).catch((e) => console.error('[Telegram] Payment notification failed:', e));

    return redirectTo(`${orderPath}?payment=success`);
  } catch (error) {
    console.error('[API] eSewa verify error:', error);
    return redirectTo('/orders?error=verification_failed');
  }
}
