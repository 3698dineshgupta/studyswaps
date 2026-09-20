/**
 * Structured security log: one JSON object per line, easy to ship to any log platform and to alert on.
 * Never pass passwords, tokens, card/eSewa secrets or full personal data here.
 */
export type SecurityEvent =
  | 'rate_limited' | 'rate_limiter_error' | 'csrf_blocked' | 'auth_required' | 'forbidden' | 'admin_action'
  | 'payment_confirmed' | 'payment_rejected' | 'payment_oversold' | 'upload_rejected' | 'validation_rejected'
  | 'withdrawal_requested' | 'suspicious_input' | 'internal_secret_rejected'

export function requestId(req?: Request): string {
  return req?.headers.get('x-request-id') ?? 'n/a'
}

export function logSecurity(event: SecurityEvent, req: Request | undefined, extra: Record<string, unknown> = {}) {
  let path: string | undefined
  try { path = req ? new URL(req.url).pathname : undefined } catch { /* ignore */ }
  const line = {
    ts: new Date().toISOString(),
    level: 'security',
    event,
    requestId: requestId(req),
    method: req?.method,
    path,
    ip: req?.headers.get('cf-connecting-ip') || req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req?.headers.get('x-real-ip') || undefined,
    ...extra,
  }
  // eslint-disable-next-line no-console
  console.warn(JSON.stringify(line))
}
