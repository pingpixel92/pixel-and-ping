import { ok, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { getIp } from '@/lib/rate-limit'
import { disconnect } from '@/lib/services/cloudflare.service'

export const DELETE = withAuth(async (_req, ctx) => {
  await disconnect({ id: ctx.auth.id, label: ctx.auth.username }, getIp(_req))
  return ok({ disconnected: true })
}, { roles: rolesFor('cloudflare:manage') })
