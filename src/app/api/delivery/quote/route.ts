import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyPlace } from '@/lib/geo';
import { getOrigin, quoteFor } from '@/lib/geoQuote';
import { rateLimit, LIMITS } from '@/lib/security/rateLimit';

const schema = z.object({
  place: z.object({ label: z.string(), lat: z.number(), lon: z.number(), sig: z.string(), city: z.string().optional() }),
});

// POST /api/delivery/quote — price the buyer's current cart for a chosen address
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    { const limited = await rateLimit(request, LIMITS.checkout, user.id); if (limited) return limited; }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success || !verifyPlace(parsed.data.place)) {
      return NextResponse.json({ error: 'Please choose an address from the search results' }, { status: 400 });
    }
    const { place } = parsed.data;

    const { data: profile } = await supabase.from('profiles').select('id').eq('auth_user_id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const { data: cart } = await supabase.from('carts').select('id').eq('profile_id', profile.id).maybeSingle();
    const { data: items } = cart
      ? await supabase.from('cart_items').select('quantity, products(id, price, location, status)').eq('cart_id', cart.id)
      : { data: null };

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const lines = ((items ?? []) as any[]).filter((i) => i.products?.status === 'ACTIVE');
    if (!lines.length) return NextResponse.json({ error: 'Your cart is empty' }, { status: 400 });

    const subtotal = lines.reduce((s, l) => s + Number(l.products.price) * l.quantity, 0);
    const origin = await getOrigin(createAdminClient(), lines[0].products.id, lines[0].products.location);
    const result = quoteFor(subtotal, origin, place);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });

    return NextResponse.json({ pricing: result.pricing, estimated: result.estimated });
  } catch (error) {
    console.error('[API] delivery quote error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Could not calculate delivery' }, { status: 500 });
  }
}
