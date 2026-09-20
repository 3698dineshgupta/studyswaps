import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { isCloudinaryConfigured, uploadImageToCloudinary } from '@/lib/cloudinary';
import { verifyImage } from '@/lib/security/imageCheck';

export const maxDuration = 30;

// POST /api/admin/withdrawals/proof — upload the eSewa payment screenshot for a payout (finance roles only)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, ['FINANCE_ADMIN']);
    if (auth.error) return auth.error;
    if (!isCloudinaryConfigured()) return NextResponse.json({ error: 'Image storage is not configured' }, { status: 503 });

    const file = (await request.formData()).get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'No screenshot received' }, { status: 400 });
    const verdict = await verifyImage(file);
    if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: 400 });

    const up = await uploadImageToCloudinary(file, 'studentmarket/payouts');
    return NextResponse.json({ url: up.url }, { status: 201 });
  } catch (err) {
    console.error('[API] payout proof upload', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
