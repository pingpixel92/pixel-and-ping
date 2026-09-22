/** Shared test helpers (no server dependencies). */
export function expiryBucketLocal(expiresAt: Date | null, soonDays = 7): 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'UNLIMITED' {
  if (!expiresAt) return 'UNLIMITED'
  if (expiresAt.getTime() < Date.now()) return 'EXPIRED'
  if (expiresAt.getTime() < Date.now() + soonDays * 86_400_000) return 'EXPIRING_SOON'
  return 'ACTIVE'
}
