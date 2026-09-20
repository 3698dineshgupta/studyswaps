import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { COMPLETED_STATUSES, ORDER_SELECT_MINE, shapeOrder } from '@/lib/orders';
import { getFastUser } from '@/lib/auth/session';
import { verifyPlace } from '@/lib/geo';
import { getOrigin, quoteFor } from '@/lib/geoQuote';
import { rateLimit, LIMITS } from '@/lib/security/rateLimit';
import { TelegramService } from '@/lib/telegram/service';

const createOrderSchema = z.object({
  delivery: z.object({
    place: z.object({ label: z.string().max(300), lat: z.number(), lon: z.number(), sig: z.string(), city: z.string().optional() }),
    address_line: z.string().trim().min(5).max(200),
    landmark: z.string().trim().min(3).max(150),
  }),
  // eSewa is the only payment method
  payment_method: z.literal('esewa'),
  contact: z.object({
    full_name: z.string().trim().min(1).max(100),
    phone: z.string().trim().min(7).max(20),
  }),
});

async function getBuyerProfile() {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, profile: null, userId: null as string | null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, account_status')
    .eq('auth_user_id', user.id)
    .single();

  return { supabase, profile, userId: user.id as string | null };
}

// GET /api/orders?status=ongoing|completed — the signed-in buyer's purchases
export async function GET(request: NextRequest) {
  try {
    // Read path: the token is verified locally, then ONE query filtered by the buyer's auth id (was: auth server + profile + orders)
    const user = await getFastUser(await createServerClient());
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tab = new URL(request.url).searchParams.get('status');
    const completedList = `(${COMPLETED_STATUSES.join(',')})`;

    // Read on the server (the database hides address columns from browsers); scoped to THIS buyer only
    let query = createAdminClient()
      .from('orders')
      .select(ORDER_SELECT_MINE)
      .eq('buyer.auth_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (tab === 'completed') query = query.in('status', COMPLETED_STATUSES);
    else if (tab === 'ongoing') query = query.not('status', 'in', completedList);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ orders: (data ?? []).map((o) => shapeOrder(o, 'buyer')) });
  } catch (error) {
    console.error('[API] Orders GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/orders — turn the buyer's cart into an order (to be paid with eSewa)
export async function POST(request: NextRequest) {
  try {
    const { supabase, profile, userId } = await getBuyerProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const limited = await rateLimit(request, LIMITS.checkout, userId);
    if (limited) return limited;

    // Buyers don't need identity verification; they only need an active account
    if (profile.account_status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Your account is not active' }, { status: 403 });
    }

    const parsed = createOrderSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please complete your delivery address and landmark', details: parsed.error.flatten() }, { status: 400 });
    }
    const input = parsed.data;

    // The address must be one we handed out (signed), so coordinates — and therefore the fee — can't be edited
    if (!verifyPlace(input.delivery.place)) {
      return NextResponse.json({ error: 'Please choose your address from the search results' }, { status: 400 });
    }
    const place = input.delivery.place;

    const { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('profile_id', profile.id)
      .maybeSingle();

    const { data: cartItems } = cart
      ? await supabase
          .from('cart_items')
          .select('id, quantity, products(id, title, condition, price, status, seller_id, location, quantity)')
          .eq('cart_id', cart.id)
      : { data: null };

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const lines = (cartItems ?? []).map((ci: any) => ({ ...ci, product: ci.products }));

    if (lines.length === 0) {
      return NextResponse.json({ error: 'Your cart is empty' }, { status: 400 });
    }
    if (lines.some((l: any) => !l.product || l.product.status !== 'ACTIVE')) {
      return NextResponse.json({ error: 'Some items in your cart are no longer available' }, { status: 409 });
    }
    // Quantity comes from the cart table, which a user could edit directly, so re-check it against real stock here
    if (lines.some((l: any) => !Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > Number(l.product.quantity ?? 1))) {
      return NextResponse.json({ error: 'The quantity in your cart is not available. Please update your cart.' }, { status: 409 });
    }
    if (lines.some((l: any) => l.product.seller_id === profile.id)) {
      return NextResponse.json({ error: 'You cannot buy your own listing' }, { status: 409 });
    }

    // An order belongs to a single seller (one payment, one wallet credit)
    const sellerIds = new Set(lines.map((l: any) => l.product.seller_id));
    if (sellerIds.size > 1) {
      return NextResponse.json(
        { error: 'Your cart has items from different sellers. Please check out one seller at a time.' },
        { status: 400 }
      );
    }
    const sellerId = lines[0].product.seller_id as string;

    // Every amount is computed here, never taken from the browser
    const subtotal = lines.reduce((sum: number, l: any) => sum + Number(l.product.price) * l.quantity, 0);
    const admin = createAdminClient();
    const origin = await getOrigin(admin, lines[0].product.id, lines[0].product.location);
    const quote = quoteFor(subtotal, origin, place);
    if (!quote.ok) return NextResponse.json({ error: quote.error }, { status: 422 });
    const { pricing } = quote;

    const deliveryLabel = `${input.delivery.address_line}, ${place.label} (near ${input.delivery.landmark})`;

    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        buyer_id: profile.id,
        seller_id: sellerId,
        status: 'CREATED',
        subtotal: pricing.subtotal,
        delivery_charge: pricing.deliveryFee,
        platform_fee: pricing.platformFee,
        total: pricing.total,
        delivery_method: 'LOCAL_DELIVERY',
        delivery_address: {
          type: 'home',
          contact: input.contact,
          address_line: input.delivery.address_line,
          landmark: input.delivery.landmark,
          place: { label: place.label, lat: place.lat, lon: place.lon },
          distance_km: pricing.distanceKm,
          distance_estimated: origin.estimated,
          pricing: { commission: pricing.commission, seller_net: pricing.sellerNet },
        },
        meeting_location: deliveryLabel,
      })
      .select('id, order_number')
      .single();

    if (orderError || !order) throw orderError;

    const { error: itemsError } = await admin.from('order_items').insert(
      lines.map((l: any) => ({
        order_id: order.id,
        product_id: l.product.id,
        title: l.product.title,
        condition: l.product.condition,
        price: l.product.price,
        quantity: l.quantity,
        seller_id: sellerId,
      }))
    );
    if (itemsError) {
      await admin.from('orders').delete().eq('id', order.id);
      throw itemsError;
    }

    const { data: deliveryRow } = await admin
      .from('deliveries')
      .insert({ order_id: order.id, current_status: 'CREATED' })
      .select('id')
      .single();

    if (deliveryRow) {
      await admin.from('delivery_events').insert({
        delivery_id: deliveryRow.id,
        status: 'CREATED',
        description: 'Order placed',
        actor_id: profile.id,
        actor_type: 'buyer',
      });
    }

    // The cart is NOT emptied here. It is emptied only when the payment is confirmed, so if the buyer cancels on
    // eSewa (or closes the tab) their items are still in the cart. Older unpaid attempts are closed so they don't pile up.
    const { data: stale } = await admin.from('orders').update({ status: 'CANCELLED' }).eq('buyer_id', profile.id).in('status', ['CREATED', 'PAYMENT_PENDING']).neq('id', order.id).select('id');
    if (stale?.length) {
      await admin.from('payments').update({ status: 'FAILED' }).in('order_id', stale.map((o) => o.id)).eq('status', 'PENDING');
      await admin.from('deliveries').update({ current_status: 'CANCELLED' }).in('order_id', stale.map((o) => o.id));
    }

    // Ops heads-up: an order was placed (it is only PAID once eSewa confirms — that sends its own alert)
    TelegramService.sendAdminNotification(`NEW ORDER (awaiting payment)
Order: ${order.order_number}
Items: ${lines.map((l: any) => `${l.product.title} x${l.quantity}`).join(', ').slice(0, 200)}
Total: Rs. ${pricing.total}
Delivery: ${pricing.distanceKm} km`).catch(() => {});

    return NextResponse.json(
      {
        success: true,
        order_id: order.id,
        order_number: order.order_number,
        requires_payment: true,
        pricing,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API] Orders POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
