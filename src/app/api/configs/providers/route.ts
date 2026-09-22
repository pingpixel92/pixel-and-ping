import { ok, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { listProviders } from '@/lib/services/providers'

export const GET = withAuth(async () => {
  return ok({ providers: listProviders() })
}, { roles: rolesFor('users:read') })
