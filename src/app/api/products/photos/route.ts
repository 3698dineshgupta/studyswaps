import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ensureBucket, uploadFile, validateImageFiles } from '@/lib/storage';
import { isCloudinaryConfigured, uploadImageToCloudinary } from '@/lib/cloudinary';
import { rateLimit, LIMITS } from '@/lib/security/rateLimit';
import { verifyImage } from '@/lib/security/imageCheck';
import { logSecurity } from '@/lib/security/log';

// POST /api/products/photos — upload ONE listing photo ahead of publishing (so the seller sees real progress
// and a failed photo can be retried without losing the others). Returns a reference the listing form sends back.
// Serverless hosts (Vercel) stop a function after 10 s by default; uploads and payment checks may need longer
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, verification_status, account_status')
      .eq('auth_user_id', user.id)
      .single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    if (profile.verification_status !== 'VERIFIED') return NextResponse.json({ error: 'Only verified students can upload photos' }, { status: 403 });
    if (profile.account_status !== 'ACTIVE') return NextResponse.json({ error: 'Your account is not active' }, { status: 403 });

    const limited = await rateLimit(request, LIMITS.photoUpload, user.id);
    if (limited) return limited;

    const file = (await request.formData()).get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'No photo received' }, { status: 400 });
    const bad = validateImageFiles([file], { min: 1, max: 1, label: 'photo' });
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
    // Read the real file header: the declared type / name are attacker-controlled
    const verdict = await verifyImage(file);
    if (!verdict.ok) { logSecurity('upload_rejected', request, { userId: user.id, reason: verdict.error }); return NextResponse.json({ error: verdict.error }, { status: 400 }); }

    if (isCloudinaryConfigured()) {
      const up = await uploadImageToCloudinary(file, 'studentmarket/products');
      return NextResponse.json({ ref: up.url }, { status: 201 });
    }
    const admin = createAdminClient();
    await ensureBucket(admin, 'product-images', true);
    return NextResponse.json({ ref: await uploadFile(admin, 'product-images', profile.id, file) }, { status: 201 });
  } catch (error) {
    console.error('[API] Listing photo upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
