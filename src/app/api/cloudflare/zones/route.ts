import { ok, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { listZones } from '@/lib/services/cloudflare.service'

export const GET = withAuth(async () => {
  const zones = await listZones()
  return ok({ zones })
}, { roles: rolesFor('cloudflare:manage') })
