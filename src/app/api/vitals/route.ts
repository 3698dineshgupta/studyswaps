import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/security/rateLimit';

const schema = z.object({
  name: z.enum(['LCP', 'CLS', 'INP', 'FCP', 'TTFB']),
  value: z.number().finite().min(0).max(600_000),
  rating: z.enum(['good', 'needs-improvement', 'poor']),
  path: z.string().max(120),
  device: z.enum(['mobile', 'desktop']),
}).strict();

// POST /api/vitals — real-user Core Web Vitals. Anonymous: only the metric, the page pattern and the device class
// are stored (no user id, no query string, no IP). One JSON line per report, ready for any log platform to chart.
export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { name: 'vitals', limit: 60, windowMs: 60_000 });
  if (limited) return limited;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 204 });
  const { name, value, rating, path, device } = parsed.data;
  // /product/<uuid> → /product/[id] so the log groups by page type instead of listing every product
  const route = path.replace(/\/[0-9a-f]{8}-[0-9a-f-]{27}/gi, '/[id]').split('?')[0];
  console.log(JSON.stringify({ level: 'perf', kind: 'web-vital', name, value: Math.round(name === 'CLS' ? value * 1000 : value), unit: name === 'CLS' ? 'milli-cls' : 'ms', rating, route, device }));
  return new NextResponse(null, { status: 204 });
}
