import type { NextRequest } from 'next/server'

/**
 * In-memory sliding-window rate limiter.
 * Suitable for a single Railway service instance.
 */

const buckets = new Map<string, number[]>()

/** Returns true when the request is allowed, false when the limit is exceeded. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (arr.length >= max) {
    buckets.set(key, arr)
    return false
  }
  arr.push(now)
  buckets.set(key, arr)

  // Periodic sweep to keep memory bounded.
  if (buckets.size > 5_000) {
    for (const [k, v] of buckets) {
      const alive = v.filter((t) => now - t < windowMs)
      if (alive.length === 0) buckets.delete(k)
      else buckets.set(k, alive)
    }
  }
  return true
}

export function getIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'local'
}
