import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { rateLimit, LIMITS } from '@/lib/security/rateLimit';
import { logSecurity } from '@/lib/security/log';

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(200) }).strict();

// POST /api/auth/login — password sign-in through OUR server, so guessing is limited:
//   • per IP:      40 attempts / 15 min
//   • per account:  8 attempts / 15 min (the account is locked out for the rest of the window, whoever is guessing)
// Errors are identical for "no such account" and "wrong password" (no account enumeration).
export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email and password.' }, { status: 400 });
    const { email, password } = parsed.data;

    const accountKey = createHash('sha256').update(email).digest('hex').slice(0, 24); // never store the raw email as a key
    const ipLimited = await rateLimit(request, LIMITS.loginIp);
    if (ipLimited) return ipLimited;
    const accountLimited = await rateLimit(request, LIMITS.loginAccount, accountKey, { ip: false });
    if (accountLimited) return accountLimited;

    const supabase = await createServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      logSecurity('forbidden', request, { reason: 'login_failed', account: accountKey });
      const unconfirmed = /not confirmed/i.test(error?.message ?? '');
      return NextResponse.json({ error: unconfirmed ? 'Please confirm your email first — we sent you a link when you signed up.' : 'That email and password don’t match.' }, { status: 401 });
    }
    // Session cookies were set on this response by the server client
    return NextResponse.json({ ok: true, intent: data.user?.user_metadata?.intent === 'seller' ? 'seller' : 'buyer' });
  } catch (err) {
    console.error('[API] login', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Sign-in is unavailable right now. Please try again.' }, { status: 500 });
  }
}
