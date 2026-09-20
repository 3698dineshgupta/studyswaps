import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createSession, IDENTITY_ERRORS } from '@/lib/identity';
import { rateLimit, LIMITS } from '@/lib/security/rateLimit';

const fail = (code: keyof typeof IDENTITY_ERRORS) =>
  NextResponse.json({ error: IDENTITY_ERRORS[code].message, code }, { status: IDENTITY_ERRORS[code].status });

// POST /api/identity-verification/session
// Issues a signed, short-lived session bound to the signed-in user: a verification id
// and a random liveness challenge. The browser cannot choose or alter any of these.
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return fail('UNAUTHORIZED');
    { const limited = await rateLimit(request, LIMITS.identity, user.id); if (limited) return limited; }

    const { data: profile } = await supabase
      .from('profiles')
      .select('verification_status')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.verification_status === 'VERIFIED') return fail('ALREADY_VERIFIED');
    if (profile && ['PENDING', 'UNDER_REVIEW'].includes(profile.verification_status)) return fail('PENDING_REVIEW');

    const session = createSession(user.id);
    return NextResponse.json({
      session_token: session.token,
      verification_id: session.verificationId,
      challenge: session.challenge,
      expires_at: session.expiresAt,
    });
  } catch (err) {
    console.error('[Identity] session error:', err instanceof Error ? err.message : 'unknown');
    return fail('SERVER_ERROR');
  }
}
