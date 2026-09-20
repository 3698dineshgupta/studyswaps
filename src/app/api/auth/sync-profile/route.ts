import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit, LIMITS } from '@/lib/security/rateLimit';

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// POST /api/auth/sync-profile — copy the details typed at sign-up (kept in the auth user's metadata) onto the
// profile. Runs after the first sign-in, so it works whether or not the project requires email confirmation.
// Only fills empty fields; never overwrites something the user has since edited.
export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  { const limited = await rateLimit(request, LIMITS.authSync, user.id); if (limited) return limited; }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('id, full_name, phone, college_name, location, is_seller').eq('auth_user_id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const updates: Record<string, unknown> = {};
  const fullName = clean(meta.full_name, 120);
  if (fullName && (!profile.full_name || profile.full_name === (user.email ?? '').split('@')[0])) updates.full_name = fullName;
  if (!profile.phone && clean(meta.phone, 20)) updates.phone = clean(meta.phone, 20);
  if (!profile.college_name && clean(meta.college, 150)) updates.college_name = clean(meta.college, 150);
  if (!profile.location && clean(meta.location, 100)) updates.location = clean(meta.location, 100);
  // Chose "sell" at sign-up: mark the account as a seller-in-waiting (creates the wallet). They still verify before listing.
  if (meta.intent === 'seller' && !profile.is_seller) updates.is_seller = true;

  if (Object.keys(updates).length) await admin.from('profiles').update(updates).eq('id', profile.id);
  return NextResponse.json({ success: true, intent: meta.intent === 'seller' ? 'seller' : 'buyer' });
}
