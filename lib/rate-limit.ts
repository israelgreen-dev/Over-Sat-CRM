/**
 * rate-limit.ts
 * Simple in-memory rate limiter for Next.js API routes.
 *
 * Note: because serverless functions can spin up multiple instances this is
 * "best-effort" — it prevents abuse within a single instance. For strict
 * global rate limiting add an upstash/redis layer later.
 */

const window = new Map<string, { count: number; resetAt: number }>()

/**
 * Returns true (allowed) or false (blocked).
 * @param key        Typically the caller's IP address.
 * @param maxPerMin  Maximum requests per 60-second window (default 20).
 */
export function rateLimit(key: string, maxPerMin = 20): boolean {
  const now = Date.now()
  const entry = window.get(key)

  if (!entry || now > entry.resetAt) {
    window.set(key, { count: 1, resetAt: now + 60_000 })
    return true
  }

  if (entry.count >= maxPerMin) return false

  entry.count++
  return true
}

/** Extract caller IP from standard proxy headers. */
export function callerIp(req: Request): string {
  const fwd = (req as any).headers?.get?.('x-forwarded-for') as string | null
  return fwd?.split(',')[0]?.trim() ?? 'unknown'
}
