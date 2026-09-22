import { ok, withAuth } from '@/lib/api'
import { getSystemHealth } from '@/lib/services/stats.service'

export const GET = withAuth(async () => {
  const data = await getSystemHealth()
  return ok(data)
})
