import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit, LIMITS } from '@/lib/security/rateLimit';
import { logSecurity } from '@/lib/security/log';
import { LAUNCH_CITIES } from '@/lib/cities';

const schema = z.object({
  full_name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(72),
  phone: z.string().trim().transform((v) => v.replace(/[\s-]/g, '')).refine((v) => /^(\+977)?9[78]\d{8}$/.test(v), 'Enter a valid Nepali mobile number'),
  college: z.string().trim().min(2).max(150),
  location: z.enum(LAUNCH_CITIES.map((c) => c.name) as [string, ...string[]]),
  intent: z.enum(['buyer', 'seller']),
}).strict();

// POST /api/auth/register — account creation through OUR server so it can be limited:
//   • 10 accounts / hour and 30 / day per IP (a college network shares one IP), 3 attempts / hour per email, 400 / day overall (circuit breaker)
// The profile details are written by the server, not trusted from the browser's metadata.
export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message;
      return NextResponse.json({ error: msg && msg !== 'Invalid' ? msg : 'Please check your details and try again.' }, { status: 400 });
    }
    const d = parsed.data;

    const emailKey = createHash('sha256').update(d.email).digest('hex').slice(0, 24);
    for (const [rule, id, ip] of [[LIMITS.signupIpHour, null, true], [LIMITS.signupIpDay, null, true], [LIMITS.signupEmail, emailKey, false], [LIMITS.signupGlobal, 'all', false]] as const) {
      const limited = await rateLimit(request, rule, id, { ip });
      if (limited) {
        logSecurity('rate_limited', request, { reason: 'signup', rule: rule.name });
        return NextResponse.json({ error: rule.name === 'signup-global' ? 'Sign-ups are paused for a moment. Please try again later.' : 'Too many accounts created from this connection. Please try again later.' }, { status: 429, headers: limited.headers });
      }
    }

    const admin = createAdminClient();
    const { data: created, error } = await admin.auth.admin.createUser({
      email: d.email, password: d.password, email_confirm: true,
      user_metadata: { full_name: d.full_name, intent: d.intent },
    });
    if (error || !created.user) {
      if (/already|registered|exists/i.test(error?.message ?? '')) return NextResponse.json({ error: 'An account with this email already exists. Try signing in instead.' }, { status: 409 });
      if (/password/i.test(error?.message ?? '')) return NextResponse.json({ error: 'Please choose a stronger password.' }, { status: 400 });
      throw error ?? new Error('createUser failed');
    }

    // The database trigger created the profile row; fill it in with the details we validated
    await admin.from('profiles').update({
      full_name: d.full_name, phone: d.phone, college_name: d.college, location: d.location,
      ...(d.intent === 'seller' ? { is_seller: true } : {}),
    }).eq('auth_user_id', created.user.id);

    // Sign them in (sets the session cookies on this response)
    const supabase = await createServerClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: d.email, password: d.password });
    return NextResponse.json({ ok: true, signedIn: !signInError, intent: d.intent }, { status: 201 });
  } catch (err) {
    console.error('[API] register', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'We could not create your account right now. Please try again.' }, { status: 500 });
  }
}
