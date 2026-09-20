import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { releaseOrderFunds } from '@/lib/wallet/release';
import { timingSafeEqual } from 'crypto';
import { logSecurity } from '@/lib/security/log';
import { z } from 'zod';

// POST /api/wallet/release — internal/ops endpoint: release one order's held earnings now.
// (Normal flow doesn't need it: buyer confirmation and the 3-day auto-release call the same function.)
export async function POST(request: NextRequest) {
  const secret = process.env.INTERNAL_SECRET;
  const given = request.headers.get('x-internal-secret') ?? '';
  // constant-time comparison (no timing side channel); refuse outright when no secret is configured
  const ok = !!secret && secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) {
    logSecurity('internal_secret_rejected', request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const parsed = z.object({ orderId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'orderId required' }, { status: 400 });
  const { orderId } = parsed.data;

  const result = await releaseOrderFunds(createAdminClient(), orderId);
  return NextResponse.json({ success: result.released, ...result });
}
