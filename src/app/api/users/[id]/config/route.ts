import { db } from '@/lib/db'
import { ApiError, ok, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { generateConfigFor } from '@/lib/services/users.service'
import { auditVpnUser } from '@/lib/services/users.service'
import { getIp } from '@/lib/rate-limit'

/**
 * GET  /api/users/:id/config — returns the current config (for copy).
 * POST /api/users/:id/config — regenerates credentials + config.
 */
export const GET = withAuth<{ id: string }>(async (_req, ctx) => {
  const user = await db.vpnUser.findUnique({ where: { id: ctx.params.id } })
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found.')
  return ok({
    username: user.username,
    protocol: user.protocol,
    config: user.config,
    configUpdatedAt: user.configUpdatedAt?.toISOString() ?? null,
  })
}, { roles: rolesFor('users:read') })

export const POST = withAuth<{ id: string }>(async (_req, ctx) => {
  const user = await db.vpnUser.findUnique({ where: { id: ctx.params.id } })
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found.')

  const config = await generateConfigFor(user.id, { regenerate: true })
  await auditVpnUser(
    'VPN_USER_REGENERATE',
    { id: ctx.auth.id, label: ctx.auth.username },
    user.id,
    user.username,
    getIp(_req),
  )
  return ok({ config })
}, { roles: rolesFor('users:write') })
