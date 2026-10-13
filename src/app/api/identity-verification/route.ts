import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit, LIMITS } from '@/lib/security/rateLimit';
import {
  DOCUMENT_TYPE_IDS,
  IDENTITY_BUCKET,
  IDENTITY_ERRORS,
  MAX_ATTEMPTS_PER_HOUR,
  MAX_DOCUMENT_BYTES,
  checkImage,
  documentImagePath,
  ensureIdentityBucket,
  normalizeCapture,
} from '@/lib/identity';

const fail = (code: keyof typeof IDENTITY_ERRORS) =>
  NextResponse.json({ error: IDENTITY_ERRORS[code].message, code }, { status: IDENTITY_ERRORS[code].status });

// POST /api/identity-verification — multipart: document_type, photo
//
// One plain photo upload is the whole verification step: no live camera, no selfie, no liveness check — a seller
// uploads whichever document they have (school ID, college ID, citizenship certificate or national ID card).
// The user id, verification id, timestamp, storage path and status are all derived here on the server.
// Serverless hosts (Vercel) stop a function after 10 s by default; uploads may need longer.
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

    const documentType = String(form.get('document_type') ?? '');
    if (!(DOCUMENT_TYPE_IDS as string[]).includes(documentType)) return fail('INVALID_DOCUMENT_TYPE');

    const photo = form.get('photo');
    if (!(photo instanceof File) || photo.size === 0) return fail('MISSING_DOCUMENT');

    const check = await checkImage(photo, { maxBytes: MAX_DOCUMENT_BYTES, minWidth: 480, minHeight: 320 });
    if (!check.ok) return fail(check.error);

    // Clean JPEG (metadata stripped), stored in the PRIVATE bucket under the user's own folder
    const jpeg = await normalizeCapture(check.buffer);
    const verificationId = randomUUID();
    const imagePath = documentImagePath(user.id, verificationId);

    await ensureIdentityBucket(admin);
    const { error: uploadError } = await admin.storage
      .from(IDENTITY_BUCKET)
      .upload(imagePath, jpeg, { contentType: 'image/jpeg', cacheControl: '0', upsert: false });
    if (uploadError) {
      return /already exists|duplicate/i.test(uploadError.message) ? fail('ALREADY_USED') : fail('STORAGE_ERROR');
    }

    const capturedAt = new Date().toISOString(); // server time, not client time
    const { error: insertError } = await admin.from('identity_verifications').insert({
      user_id: user.id,
      verification_id: verificationId,
      image_path: imagePath,
      captured_at: capturedAt,
      status: 'pending',
      // No live-capture / liveness check applies to a document upload; the column is NOT NULL so it is set true.
      liveness_passed: true,
      mime_type: 'image/jpeg',
      file_size: jpeg.length,
    });
    if (insertError) {
      await admin.storage.from(IDENTITY_BUCKET).remove([imagePath]);
      return insertError.code === '23505' ? fail('ALREADY_USED') : fail('SERVER_ERROR');
    }

    // Retake housekeeping: drop this user's older, never-submitted uploads
    const { data: stale } = await admin
      .from('identity_verifications')
      .select('id, image_path')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .neq('verification_id', verificationId);
    if (stale?.length) {
      await admin.storage.from(IDENTITY_BUCKET).remove(stale.map((s) => s.image_path));
      await admin.from('identity_verifications').delete().in('id', stale.map((s) => s.id));
    }

    // Audit trail (metadata only — never the image)
    const { data: actor } = await admin.from('profiles').select('id').eq('auth_user_id', user.id).single();
    await admin.from('audit_logs').insert({
      actor_id: actor?.id ?? null,
      actor_email: user.email,
      action: 'IDENTITY_DOCUMENT_RECEIVED',
      entity_type: 'identity_verification',
      entity_id: verificationId,
      new_data: { document_type: documentType, size: jpeg.length },
    });

    return NextResponse.json({ success: true, verification_id: verificationId, document_type: documentType, status: 'pending' }, { status: 201 });
  } catch (err) {
    // Never log request bodies or image data
    console.error('[Identity] upload error:', err instanceof Error ? err.message : 'unknown');
    return fail('SERVER_ERROR');
  }
}
