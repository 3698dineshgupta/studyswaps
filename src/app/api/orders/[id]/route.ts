import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { ORDER_SELECT, shapeOrder } from '@/lib/orders';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit, LIMITS } from '@/lib/security/rateLimit';
import { z } from 'zod';
import { getFastUser } from '@/lib/auth/session';

// GET /api/orders/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!z.string().uuid().safeParse(params.id).success) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    const supabase = await createServerClient();

    const user = await getFastUser(supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await rateLimit(request, LIMITS.read, user.id);
    if (limited) return limited;

    // ONE query. The database hides address columns from browsers, so the server reads the order itself, and only
    // hands it over after checking the (locally verified) caller is the buyer or the seller of THIS order.
    const admin = createAdminClient();
    const { data: order, error } = await admin.from('orders').select(ORDER_SELECT).eq('id', params.id).maybeSingle();

    // Same answer for "doesn't exist" and "not yours" so order IDs can't be probed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const o = order as any;
    const mine = o && (o.buyer?.auth_user_id === user.id ? 'buyer' : o.seller?.auth_user_id === user.id ? 'seller' : null);
    if (error || !order || !mine) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ order: shapeOrder(order, mine) });
  } catch (error) {
    console.error('[API] Order GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
