import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { TelegramService } from '@/lib/telegram/service';
import { DOCUMENT_TYPE_IDS, IDENTITY_ERRORS } from '@/lib/identity';
import { rateLimit, LIMITS } from '@/lib/security/rateLimit';

const bodySchema = z.object({
  document_type: z.enum(DOCUMENT_TYPE_IDS as [string, ...string[]]),
  verification_id: z.string().uuid(),
  form: z.object({
    full_name: z.string().trim().min(2).max(100),
    date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
    college_name: z.string().trim().min(2).max(200),
    student_id_number: z.string().trim().max(50).optional().or(z.literal('')),
  }),
});

const UPLOAD_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const fail = (code: keyof typeof IDENTITY_ERRORS, message?: string) =>
  NextResponse.json({ error: message ?? IDENTITY_ERRORS[code].message, code }, { status: IDENTITY_ERRORS[code].status });

// POST /api/verification/submit — JSON: { document_type, verification_id, form }
// The photo was already uploaded and stored by /api/identity-verification. This route only
// *references* that server-created record by its verification id — it never accepts an image,
// path or URL from the browser, and only the document's owner can submit it.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return fail('UNAUTHORIZED');
    { const limited = await rateLimit(request, LIMITS.identity, user.id); if (limited) return limited; }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, verification_status')
      .eq('auth_user_id', user.id)
      .single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    if (profile.verification_status === 'VERIFIED') return fail('ALREADY_VERIFIED');
    if (['PENDING', 'UNDER_REVIEW'].includes(profile.verification_status)) return fail('PENDING_REVIEW');

    let raw: unknown;
    try { raw = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please fill in all required fields', details: parsed.error.flatten() }, { status: 400 });
    }
    const { document_type: documentType, verification_id: verificationId, form } = parsed.data;

    const admin = createAdminClient();

    // Look the upload up by (verification id AND the authenticated user): another user's id simply doesn't match
    const { data: capture } = await admin
      .from('identity_verifications')
      .select('id, status, captured_at')
      .eq('verification_id', verificationId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!capture) return fail('MISSING_DOCUMENT', 'We could not find your uploaded document. Please upload it again.');
    if (capture.status !== 'pending') return fail('ALREADY_USED');
    if (Date.now() - new Date(capture.captured_at).getTime() > UPLOAD_MAX_AGE_MS) return fail('DOCUMENT_EXPIRED');

    const { data: created, error: requestError } = await admin
      .from('verification_requests')
      .insert({
        profile_id: profile.id,
        method: documentType,
        status: 'PENDING',
        full_name: form.full_name,
        date_of_birth: form.date_of_birth || null,
        college_name: form.college_name,
        student_id: form.student_id_number || 'N/A',
        identity_verification_id: capture.id,
      })
      .select('id, verification_number, submitted_at')
      .single();

    if (requestError || !created) {
      // 23505 = this upload is already linked to a request
      if (requestError?.code === '23505') return fail('ALREADY_USED');
      throw requestError;
    }

    await admin.from('identity_verifications').update({ status: 'under_review' }).eq('id', capture.id);

    await admin
      .from('profiles')
      .update({ verification_status: 'PENDING', college_name: form.college_name, college_id: form.student_id_number || null })
      .eq('id', profile.id);

    await admin.from('audit_logs').insert({
      actor_id: profile.id,
      actor_email: user.email,
      action: 'VERIFICATION_SUBMITTED',
      entity_type: 'verification_request',
      entity_id: created.id,
      new_data: { method: documentType, identity_verification: verificationId },
    });

    // Notify reviewers (no image is sent); queue a retry if Telegram is down
    try {
      const result = await TelegramService.archiveVerification({
        verificationId: created.id,
        verificationNumber: created.verification_number,
        fullName: form.full_name,
        college: form.college_name,
        method: `${documentType} · uploaded document`,
        studentId: form.student_id_number || 'N/A',
        submittedAt: new Date(created.submitted_at).toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu' }),
      });
      if (!result.ok) throw new Error(result.error);
    } catch (telegramError) {
      console.error('[Telegram] Verification archive failed:', telegramError instanceof Error ? telegramError.message : 'unknown');
      await admin.from('telegram_sync_jobs').insert({
        entity_type: 'verification_request',
        entity_id: created.id,
        operation: 'ARCHIVE_VERIFICATION',
        status: 'FAILED',
        last_error: String(telegramError),
        next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
    }

    return NextResponse.json({ success: true, verification_number: created.verification_number, status: 'PENDING' }, { status: 201 });
  } catch (error) {
    console.error('[API] Verification submit error:', error instanceof Error ? error.message : 'unknown');
    return fail('SERVER_ERROR');
  }
}
