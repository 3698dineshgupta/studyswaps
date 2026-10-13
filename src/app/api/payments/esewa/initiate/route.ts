import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { startEsewaPaymentForOrder } from '@/lib/esewa/initiate';
import { rateLimit, LIMITS } from '@/lib/security/rateLimit';

const initiateSchema = z.object({
  orderId: z.string().uuid(),
});

// POST /api/payments/esewa/initiate — returns signed form fields for eSewa, for an order created earlier
// (checkout itself gets this in the same response as creating the order — see /api/orders — so this route
// is mainly for "Pay now" on an order the buyer comes back to after cancelling or leaving eSewa).
export async function POST(request: NextRequest) {
  try {
    // Parse first: no point spending a round trip on auth/DB for a malformed request
    const parsed = initiateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    { const limited = await rateLimit(request, LIMITS.payment, user.id); if (limited) return limited; }

    // Profile and order are independent lookups (both only need the signed-in session) — one round trip, not two
    const [{ data: profile }, { data: order }] = await Promise.all([
      supabase.from('profiles').select('id').eq('auth_user_id', user.id).single(),
      supabase.from('orders').select('id, order_number, status, subtotal, delivery_charge, platform_fee, total, buyer_id').eq('id', parsed.data.orderId).single(),
    ]);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    // RLS already limits the order read to the buyer's/seller's orders; still check ownership explicitly
    if (order.buyer_id !== profile.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!['CREATED', 'PAYMENT_PENDING'].includes(order.status)) {
      return NextResponse.json({ error: 'Order is not awaiting payment' }, { status: 409 });
    }

    // Payment writes are server-only (no RLS write policies) — use the service role
    const admin = createAdminClient();
    const payment = await startEsewaPaymentForOrder(admin, order);

    return NextResponse.json({ success: true, payment });
  } catch (error) {
    console.error('[API] eSewa initiate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
