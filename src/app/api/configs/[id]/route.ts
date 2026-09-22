import { db } from '@/lib/db'
import { ApiError, ok, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { getIp } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'

export const DELETE = withAuth<{ id: string }>(async (_req, ctx) => {
  const config = await db.config.findUnique({ where: { id: ctx.params.id } })
  if (!config) throw new ApiError(404, 'NOT_FOUND', 'Config not found.')

  await db.config.delete({ where: { id: config.id } })
  await audit({
    actorId: ctx.auth.id,
    actorLabel: ctx.auth.username,
    action: 'CONFIG_DELETE',
    resourceType: 'CONFIG',
    resourceId: config.id,
    metadata: { name: config.name },
    ip: getIp(_req),
  })
  return ok({ deleted: true })
}, { roles: rolesFor('users:write') })
