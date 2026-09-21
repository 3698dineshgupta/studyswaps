import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit, LIMITS } from '@/lib/security/rateLimit';
import {
  IDENTITY_BUCKET,
  IDENTITY_ERRORS,
  MAX_CAPTURE_BYTES,
  checkImage,
  createCardToken,
  ensureIdentityBucket,
  idCardTempPath,
  normalizeCapture,
} from '@/lib/identity';

const fail = (code: keyof typeof IDENTITY_ERRORS) =>
  NextResponse.json({ error: IDENTITY_ERRORS[code].message, code }, { status: IDENTITY_ERRORS[code].status });

export const maxDuration = 30;

// POST /api/identity-verification/id-card — multipart: capture
// Step 1 of live verification: the FRONT of the student ID card, grabbed from the live camera. The server stores it in the
// private bucket under the user's own folder and returns a signed token; the selfie upload must present that token, which
// is how the two photos get attached to the same verification.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return fail('UNAUTHORIZED');
    { const limited = await rateLimit(request, LIMITS.identity, user.id); if (limited) return limited; }

    const admin = createAdminClient();
    const { data: profile } = await admin.from('profiles').select('verification_status').eq('auth_user_id', user.id).single();
    if (profile?.verification_status === 'VERIFIED') return fail('ALREADY_VERIFIED');
    if (profile && ['PENDING', 'UNDER_REVIEW'].includes(profile.verification_status)) return fail('PENDING_REVIEW');

    const capture = (await request.formData()).get('capture');
    if (!(capture instanceof File) || capture.size === 0) return fail('MISSING_CAPTURE');

    // An ID card has small print: insist on a reasonably sharp photo
    const check = await checkImage(capture, { maxBytes: MAX_CAPTURE_BYTES, minWidth: 640, minHeight: 400 });
    if (!check.ok) return fail(check.error);

    const jpeg = await normalizeCapture(check.buffer);
    const { cardId, token } = createCardToken(user.id);

    await ensureIdentityBucket(admin);
    const { error: uploadError } = await admin.storage
      .from(IDENTITY_BUCKET)
      .upload(idCardTempPath(user.id, cardId), jpeg, { contentType: 'image/jpeg', cacheControl: '0', upsert: false });
    if (uploadError) return fail('STORAGE_ERROR');

    return NextResponse.json({ success: true, id_card_token: token }, { status: 201 });
  } catch (err) {
    console.error('[Identity] id-card upload error:', err instanceof Error ? err.message : 'unknown');
    return fail('SERVER_ERROR');
  }
}
