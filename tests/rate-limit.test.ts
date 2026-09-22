import { describe, expect, it } from 'vitest'
import { rateLimit } from '../src/lib/rate-limit'
import { formatBytes, formatNumber } from '../src/lib/format'
import { expiryBucketLocal } from './helpers'

describe('rate limiter (sliding window)', () => {
  it('allows up to the limit then blocks', () => {
    const key = `test-${Math.random()}`
    expect(rateLimit(key, 3, 1000)).toBe(true)
    expect(rateLimit(key, 3, 1000)).toBe(true)
    expect(rateLimit(key, 3, 1000)).toBe(true)
    expect(rateLimit(key, 3, 1000)).toBe(false)
  })

  it('is isolated per key', () => {
    const a = `a-${Math.random()}`
    const b = `b-${Math.random()}`
    expect(rateLimit(a, 1, 1000)).toBe(true)
    expect(rateLimit(b, 1, 1000)).toBe(true)
    expect(rateLimit(a, 1, 1000)).toBe(false)
  })

  it('recovers after the window passes', async () => {
    const key = `recover-${Math.random()}`
    expect(rateLimit(key, 1, 60)).toBe(true)
    expect(rateLimit(key, 1, 60)).toBe(false)
    await new Promise((r) => setTimeout(r, 80))
    expect(rateLimit(key, 1, 60)).toBe(true)
  })
})

describe('formatting helpers', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1048576)).toBe('1.0 MB')
    expect(formatBytes('1560576')).toBe('1.5 MB')
  })

  it('formats numbers', () => {
    expect(formatNumber(1284)).toBe('1,284')
    expect(formatNumber('42')).toBe('42')
  })

  it('computes expiry buckets server-side semantics', () => {
    const now = Date.now()
    expect(expiryBucketLocal(null)).toBe('UNLIMITED')
    expect(expiryBucketLocal(new Date(now - 1000))).toBe('EXPIRED')
    expect(expiryBucketLocal(new Date(now + 3 * 86_400_000))).toBe('EXPIRING_SOON')
    expect(expiryBucketLocal(new Date(now + 30 * 86_400_000))).toBe('ACTIVE')
  })
})
