import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { reversePlace } from '@/lib/geo';
import { rateLimit, LIMITS } from '@/lib/security/rateLimit';

// GET /api/geocode/reverse?lat=..&lon=.. — the map pin → a signed place. Only inside our launch cities.
export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please log in to use the map' }, { status: 401 });
  { const limited = await rateLimit(request, LIMITS.geocode, user.id); if (limited) return limited; }

  const sp = new URL(request.url).searchParams;
  try {
    const place = await reversePlace(Number(sp.get('lat')), Number(sp.get('lon')));
    if (!place) return NextResponse.json({ error: 'We only deliver in Kathmandu and Butwal for now. Move the pin inside one of them.' }, { status: 422 });
    return NextResponse.json({ place });
  } catch (err) {
    console.error('[geocode/reverse]', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Map lookup is unavailable right now. Please try again.' }, { status: 502 });
  }
}
