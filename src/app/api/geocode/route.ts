import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { searchPlaces } from '@/lib/geo';
import { isCitySlug } from '@/lib/cities';
import { rateLimit, LIMITS } from '@/lib/security/rateLimit';

// GET /api/geocode?q=thamel — address suggestions (signed places). Signed-in users only.
export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please log in to search addresses' }, { status: 401 });
  { const limited = await rateLimit(request, LIMITS.geocode, user.id); if (limited) return limited; }

  const sp = new URL(request.url).searchParams;
  const q = sp.get('q') ?? '';
  const city = sp.get('city');
  try {
    return NextResponse.json({ places: await searchPlaces(q, isCitySlug(city) ? city : null) });
  } catch (err) {
    console.error('[geocode]', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Address search is unavailable right now. Please try again.' }, { status: 502 });
  }
}
