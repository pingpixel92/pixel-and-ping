import { db } from '@/lib/db'
import { ok, withAuth, ApiError } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { checkServerById } from '@/lib/services/health.service'
import { getIp } from '@/lib/rate-limit'
import { rateLimit } from '@/lib/rate-limit'
import { logEvent } from '@/lib/audit'

/** POST /api/servers/:id/test — performs a REAL connectivity check now. */
export const POST = withAuth<{ id: string }>(async (req, ctx) => {
  if (!rateLimit(`server-test:${ctx.auth.id}`, 30, 60_000)) {
    throw new ApiError(429, 'RATE_LIMITED', 'Too many checks. Wait a moment.')
  }
  const server = await db.server.findUnique({ where: { id: ctx.params.id } })
  if (!server) throw new ApiError(404, 'NOT_FOUND', 'Server not found.')

  const result = await checkServerById(server.id)
  await logEvent({
    level: result.ok ? 'INFO' : 'WARN',
    action: 'SERVER_TEST',
    actor: ctx.auth.username,
    userId: ctx.auth.id,
    resourceType: 'SERVER',
    resourceId: server.id,
    message: result.ok
      ? `Server "${server.name}" is online (${result.latencyMs} ms)`
      : `Server "${server.name}" check failed: ${result.error}`,
    ip: getIp(req),
  })

  const updated = await db.server.findUnique({ where: { id: server.id } })
  return ok({
    ok: result.ok,
    latencyMs: result.latencyMs,
    error: result.error ?? null,
    status: updated?.status ?? 'UNKNOWN',
    checkedAt: updated?.lastCheckAt?.toISOString() ?? null,
  })
}, { roles: rolesFor('infra:write') })
