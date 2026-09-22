import { ok, withAuth } from '@/lib/api'
import { getDashboard } from '@/lib/services/stats.service'

export const GET = withAuth(async () => {
  const data = await getDashboard()
  return ok(data)
})
