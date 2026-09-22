import { db } from '@/lib/db'
import { ApiError, ok, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { getIp } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'

/** DELETE /api/api-keys/:id — revokes (soft-delete) an API key. */
export const DELETE = withAuth<{ id: string }>(async (req, ctx) => {
  const apiKey = await db.apiKey.findUnique({ where: { id: ctx.params.id } })
  if (!apiKey) throw new ApiError(404, 'NOT_FOUND', 'API key not found.')
  if (apiKey.revokedAt) throw new ApiError(409, 'CONFLICT', 'API key is already revoked.')

  await db.apiKey.update({ where: { id: apiKey.id }, data: { revokedAt: new Date() } })
  await audit({
    actorId: ctx.auth.id,
    actorLabel: ctx.auth.username,
    action: 'API_KEY_REVOKE',
    resourceType: 'API_KEY',
    resourceId: apiKey.id,
    ip: getIp(req),
    metadata: { name: apiKey.name, prefix: apiKey.prefix },
  })
  return ok({ revoked: true })
}, { roles: rolesFor('apikeys:manage') })
