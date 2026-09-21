import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { TelegramService } from '@/lib/telegram/service';
import { IDENTITY_BUCKET } from '@/lib/identity';
import { notify } from '@/lib/notify';

const BUCKET = 'verification-documents';
const REVIEWER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'VERIFICATION_REVIEWER'];

const reviewSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  rejectionReason: z.string().trim().min(3).max(500).optional(),
});

/** Signed-in user must hold an active reviewer/admin role. */
async function requireReviewer() {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name')
    .eq('auth_user_id', user.id)
    .single();
  if (!profile) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };

  const { data: role } = await admin
    .from('admin_roles')
    .select('role')
    .eq('profile_id', profile.id)
    .eq('is_active', true)
    .in('role', REVIEWER_ROLES)
    .limit(1)
    .maybeSingle();
  if (!role) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };

  return { admin, profile, user };
}

// GET /api/admin/verification?status=PENDING&page=1 — review queue with signed document links
export async function GET(request: NextRequest) {
  try {
    const auth = await requireReviewer();
    if (auth.error) return auth.error;
    const { admin } = auth;

    const params = new URL(request.url).searchParams;
    const status = params.get('status') || '';
    const page = Math.max(1, Number(params.get('page') || '1'));
    const pageSize = 20;

    let query = admin
      .from('verification_requests')
      .select(
        `*, profiles!verification_requests_profile_id_fkey(full_name, phone, location),
         verification_documents(id, document_type, storage_path),
         identity_verifications!verification_requests_identity_verification_id_fkey(id, image_path, captured_at, challenge, liveness_score, liveness_passed, status)`,
        { count: 'exact' }
      )
      .order('submitted_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (status) query = query.eq('status', status);

    const { data, count, error } = await query;
    if (error) throw error;

    // Private bucket: hand out short-lived signed URLs (5 min)
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const rows = (data ?? []) as any[];
    const paths = rows.flatMap((r) => (r.verification_documents ?? []).map((d: any) => d.storage_path));
    const signed = paths.length ? (await admin.storage.from(BUCKET).createSignedUrls(paths, 120)).data ?? [] : [];
    const urlByPath = new Map(signed.map((s: any) => [s.path, s.signedUrl]));

    // Live captures live in a separate PRIVATE bucket; links expire after 2 minutes
    const identityPaths = rows.map((r) => r.identity_verifications?.image_path).filter(Boolean) as string[];
    const frontOf = (p: string) => p.replace(/identity_capture\.jpg$/, 'id_front.jpg');
    const identitySigned = identityPaths.length
      ? (await admin.storage.from(IDENTITY_BUCKET).createSignedUrls([...identityPaths, ...identityPaths.map(frontOf)], 120)).data ?? []
      : [];
    const identityUrl = new Map(identitySigned.map((s: any) => [s.path, s.signedUrl]));

    if (identityPaths.length) {
      // Access log: who was handed links to identity images (metadata only)
      await admin.from('audit_logs').insert({
        actor_id: auth.profile.id,
        actor_email: auth.user.email,
        action: 'IDENTITY_IMAGES_VIEWED',
        entity_type: 'identity_verification',
        new_data: { count: identityPaths.length },
      });
    }

    const requests = rows.map((r) => {
      const idv = r.identity_verifications;
      const frontUrl = idv ? identityUrl.get(frontOf(idv.image_path)) : null;
      const liveDoc = idv
        ? [...(frontUrl ? [{ id: `${idv.id}-front`, document_type: 'ID_CARD_FRONT', storage_path: frontOf(idv.image_path), signed_url: frontUrl }] : []), {
            id: idv.id,
            document_type: 'LIVE_CAPTURE',
            storage_path: idv.image_path,
            signed_url: identityUrl.get(idv.image_path) ?? null,
            captured_at: idv.captured_at,
            challenge: idv.challenge,
            liveness_score: idv.liveness_score,
            liveness_passed: idv.liveness_passed,
          }]
        : [];
      return {
        ...r,
        identity_verifications: undefined, // don't ship the raw storage path twice
        verification_method: r.method,
        student_profiles: { college_name: r.college_name, student_id_number: r.student_id, date_of_birth: r.date_of_birth },
        verification_documents: [
          ...liveDoc,
          ...(r.verification_documents ?? []).map((d: any) => ({ ...d, signed_url: urlByPath.get(d.storage_path) ?? null })),
        ],
      };
    });

    const [{ count: pending }, { count: underReview }] = await Promise.all([
      admin.from('verification_requests').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
      admin.from('verification_requests').select('*', { count: 'exact', head: true }).eq('status', 'UNDER_REVIEW'),
    ]);

    return NextResponse.json({ requests, total: count ?? 0, pending: pending ?? 0, underReview: underReview ?? 0 });
  } catch (error) {
    console.error('[API] Admin verification list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/verification — approve or reject a request
export async function POST(request: NextRequest) {
  try {
    const auth = await requireReviewer();
    if (auth.error) return auth.error;
    const { admin, profile: reviewer, user } = auth;

    const parsed = reviewSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }
    const { requestId, action, rejectionReason } = parsed.data;

    if (action === 'reject' && !rejectionReason) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
    }

    const { data: vr } = await admin
      .from('verification_requests')
      .select('id, profile_id, status, verification_number, full_name, identity_verification_id')
      .eq('id', requestId)
      .single();

    if (!vr) return NextResponse.json({ error: 'Verification request not found' }, { status: 404 });
    if (!['PENDING', 'UNDER_REVIEW'].includes(vr.status)) {
      return NextResponse.json({ error: 'Verification request is not pending review' }, { status: 409 });
    }

    const approved = action === 'approve';
    const newStatus = approved ? 'VERIFIED' : 'REJECTED';
    const now = new Date();
    const expiry = new Date(now);
    expiry.setFullYear(expiry.getFullYear() + 1);

    // Claim the request first so two reviewers can't both act on it
    const { data: claimed, error: vrError } = await admin
      .from('verification_requests')
      .update({
        status: newStatus,
        reviewed_at: now.toISOString(),
        reviewed_by: reviewer.id,
        rejection_reason: approved ? null : rejectionReason,
        expires_at: approved ? expiry.toISOString() : null,
      })
      .eq('id', requestId)
      .in('status', ['PENDING', 'UNDER_REVIEW'])
      .select('id');
    if (vrError) throw vrError;
    if (!claimed?.length) {
      return NextResponse.json({ error: 'Verification request is not pending review' }, { status: 409 });
    }

    await admin
      .from('identity_verifications')
      .update({
        status: approved ? 'verified' : 'rejected',
        reviewed_by: reviewer.id,
        reviewed_at: now.toISOString(),
        rejection_reason: approved ? null : rejectionReason,
      })
      .eq('id', vr.identity_verification_id ?? '00000000-0000-0000-0000-000000000000');

    const { error: profileError } = await admin
      .from('profiles')
      .update({ verification_status: newStatus })
      .eq('id', vr.profile_id);
    if (profileError) throw profileError;

    await admin.from('audit_logs').insert({
      actor_id: reviewer.id,
      actor_email: user.email,
      action: `VERIFICATION_${newStatus}`,
      entity_type: 'verification_request',
      entity_id: requestId,
      new_data: { target_profile: vr.profile_id, rejection_reason: rejectionReason ?? null },
    });

    await notify(vr.profile_id, approved
      ? { type: 'VERIFICATION_STATUS', title: "You're verified!", body: 'Your student identity was approved. You can now list items for sale and get paid on StudySwaps.', actionUrl: '/sell', email: { subject: 'You are verified on StudySwaps ✅', cta: 'Start selling' } }
      : { type: 'VERIFICATION_STATUS', title: 'Verification needs attention', body: `Your verification was not approved${rejectionReason ? `: ${rejectionReason}` : ''}. You can submit a new live photo.`, actionUrl: '/verify', email: { subject: 'Your StudySwaps verification needs attention', cta: 'Try again' } });

    TelegramService.sendAdminNotification(
      `${approved ? '✅' : '❌'} VERIFICATION ${newStatus}\n\nRequest: ${vr.verification_number}\nStudent: ${vr.full_name}\nReviewer: ${reviewer.full_name}${
        rejectionReason ? `\nReason: ${rejectionReason}` : ''
      }`
    ).catch((e) => console.error('[Telegram] Verification review notification failed:', e));

    return NextResponse.json({ success: true, requestId, status: newStatus });
  } catch (error) {
    console.error('[API] Admin verification review error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
