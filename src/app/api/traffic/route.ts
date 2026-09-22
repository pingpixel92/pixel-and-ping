import { ok, searchParams, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { getTraffic, parseRange } from '@/lib/services/stats.service'

export const GET = withAuth(async (req) => {
  const range = parseRange(searchParams(req).get('range'))
  const data = await getTraffic(range)
  return ok(data)
}, { roles: rolesFor('infra:read') })
