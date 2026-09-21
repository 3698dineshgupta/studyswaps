import { rateLimit, LIMITS } from '@/lib/security/rateLimit';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  IDENTITY_BUCKET,
  IDENTITY_ERRORS,
  MAX_ATTEMPTS_PER_HOUR,
  MAX_CAPTURE_BYTES,
  MAX_FRAME_BYTES,
  MIN_LIVENESS_SCORE,
  checkImage,
  ensureIdentityBucket,
  idCardTempPath,
  idFrontPath,
  identityImagePath,
  livenessScore,
  normalizeCapture,
  verifyCardToken,
  verifySession,
} from '@/lib/identity';

const fail = (code: keyof typeof IDENTITY_ERRORS) =>
  NextResponse.json({ error: IDENTITY_ERRORS[code].message, code }, { status: IDENTITY_ERRORS[code].status });

// POST /api/identity-verification — multipart: session_token, capture, frame_1, frame_2
//
// The user id, verification id, challenge, timestamp, image path and status are all
// derived here on the server. Nothing security-relevant is read from the request body.
// Serverless hosts (Vercel) stop a function after 10 s by default; uploads and payment checks may need longer
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return fail('UNAUTHORIZED');
    { const limited = await rateLimit(request, LIMITS.identity, user.id); if (limited) return limited; }

    const admin = createAdminClient();

    const { data: profile } = await admin
      .from('profiles')
      .select('verification_status')
      .eq('auth_user_id', user.id)
      .single();
    if (profile?.verification_status === 'VERIFIED') return fail('ALREADY_VERIFIED');
    if (profile && ['PENDING', 'UNDER_REVIEW'].includes(profile.verification_status)) return fail('PENDING_REVIEW');

    // Rate limit attempts per user
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recent } = await admin
      .from('identity_verifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', since);
    if ((recent ?? 0) >= MAX_ATTEMPTS_PER_HOUR) return fail('RATE_LIMITED');

    const form = await request.formData();

    // The signed session decides who this capture belongs to and which challenge was issued
    const session = verifySession(String(form.get('session_token') ?? ''), user.id);
    if (!session.ok) return fail(session.error);
    const { v: verificationId, c: challenge } = session.payload;

    // The front of the ID card must have been captured first; its token proves it is this user's photo
    const cardId = verifyCardToken(String(form.get('id_card_token') ?? ''), user.id);
    if (!cardId) return fail(form.get('id_card_token') ? 'ID_CARD_INVALID' : 'ID_CARD_MISSING');

    const capture = form.get('capture');
    if (!(capture instanceof File) || capture.size === 0) return fail('MISSING_CAPTURE');

    const captureCheck = await checkImage(capture, { maxBytes: MAX_CAPTURE_BYTES, minWidth: 480, minHeight: 360 });
    if (!captureCheck.ok) return fail(captureCheck.error);

    // Liveness frames taken during the challenge (small, discarded after scoring)
    const frames: Buffer[] = [];
    for (const key of ['frame_1', 'frame_2']) {
      const f = form.get(key);
      if (!(f instanceof File)) return fail('LIVENESS_FAILED');
      const check = await checkImage(f, { maxBytes: MAX_FRAME_BYTES });
      if (!check.ok) return fail(check.error);
      frames.push(check.buffer);
    }

    const score = await livenessScore(frames, captureCheck.buffer);
    const livenessPassed = score >= MIN_LIVENESS_SCORE;
    if (!livenessPassed) return fail('LIVENESS_FAILED');

    // Clean JPEG (metadata stripped), stored in the PRIVATE bucket under the user's own folder
    const jpeg = await normalizeCapture(captureCheck.buffer);
    const imagePath = identityImagePath(user.id, verificationId);

    await ensureIdentityBucket(admin);
    const { error: uploadError } = await admin.storage
      .from(IDENTITY_BUCKET)
      .upload(imagePath, jpeg, { contentType: 'image/jpeg', cacheControl: '0', upsert: false });
    if (uploadError) {
      return /already exists|duplicate/i.test(uploadError.message) ? fail('ALREADY_USED') : fail('STORAGE_ERROR');
    }

    // Attach the ID card photo to this verification (a copy, so a retaken selfie can attach it again)
    const frontPath = idFrontPath(user.id, verificationId);
    const { error: copyError } = await admin.storage.from(IDENTITY_BUCKET).copy(idCardTempPath(user.id, cardId), frontPath);
    if (copyError && !/already exists|duplicate/i.test(copyError.message)) {
      await admin.storage.from(IDENTITY_BUCKET).remove([imagePath]);
      return fail('ID_CARD_INVALID');
    }

    const capturedAt = new Date().toISOString(); // server time, not client time
    const { error: insertError } = await admin.from('identity_verifications').insert({
      user_id: user.id,
      verification_id: verificationId,
      image_path: imagePath,
      captured_at: capturedAt,
      status: 'pending',
      challenge,
      liveness_score: score,
      liveness_passed: livenessPassed,
      mime_type: 'image/jpeg',
      file_size: jpeg.length,
    });
    if (insertError) {
      await admin.storage.from(IDENTITY_BUCKET).remove([imagePath, frontPath]);
      return insertError.code === '23505' ? fail('ALREADY_USED') : fail('SERVER_ERROR');
    }

    // Retake housekeeping: drop this user's older, never-submitted captures
    const { data: stale } = await admin
      .from('identity_verifications')
      .select('id, image_path')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .neq('verification_id', verificationId);
    if (stale?.length) {
      await admin.storage.from(IDENTITY_BUCKET).remove(stale.flatMap((s) => [s.image_path, s.image_path.replace(/identity_capture\.jpg$/, 'id_front.jpg')]));
      await admin.from('identity_verifications').delete().in('id', stale.map((s) => s.id));
    }

    // Audit trail (metadata only — never the image)
    const { data: actor } = await admin.from('profiles').select('id').eq('auth_user_id', user.id).single();
    await admin.from('audit_logs').insert({
      actor_id: actor?.id ?? null,
      actor_email: user.email,
      action: 'IDENTITY_CAPTURE_RECEIVED',
      entity_type: 'identity_verification',
      entity_id: verificationId,
      new_data: { challenge, liveness_score: score, size: jpeg.length, id_card: true },
    });

    return NextResponse.json({ success: true, verification_id: verificationId, captured_at: capturedAt, status: 'pending' }, { status: 201 });
  } catch (err) {
    // Never log request bodies or image data
    console.error('[Identity] upload error:', err instanceof Error ? err.message : 'unknown');
    return fail('SERVER_ERROR');
  }
}
