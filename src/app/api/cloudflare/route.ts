import { ok, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { getStatus } from '@/lib/services/cloudflare.service'

export const GET = withAuth(async () => {
  return ok(await getStatus())
}, { roles: rolesFor('cloudflare:manage') })
