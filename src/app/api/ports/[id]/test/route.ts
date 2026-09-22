import { db } from '@/lib/db'
import { ApiError, ok, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { checkPortById } from '@/lib/services/health.service'
import { getIp, rateLimit } from '@/lib/rate-limit'
import { logEvent } from '@/lib/audit'

export const POST = withAuth<{ id: string }>(async (req, ctx) => {
  if (!rateLimit(`port-test:${ctx.auth.id}`, 30, 60_000)) {
    throw new ApiError(429, 'RATE_LIMITED', 'Too many checks. Wait a moment.')
  }
  const port = await db.port.findUnique({ where: { id: ctx.params.id } })
  if (!port) throw new ApiError(404, 'NOT_FOUND', 'Port not found.')

  const result = await checkPortById(port.id)
  await logEvent({
    level: result.ok ? 'INFO' : 'WARN',
    action: 'PORT_TEST',
    actor: ctx.auth.username,
    userId: ctx.auth.id,
    resourceType: 'PORT',
    resourceId: port.id,
    message: result.ok
      ? `Port ${port.number} is reachable (${result.latencyMs} ms)`
      : `Port ${port.number} check failed: ${result.error}`,
    ip: getIp(req),
  })

  const updated = await db.port.findUnique({ where: { id: port.id } })
  return ok({
    ok: result.ok,
    latencyMs: result.latencyMs,
    error: result.error ?? null,
    status: updated?.status ?? 'UNKNOWN',
    checkedAt: updated?.lastCheckAt?.toISOString() ?? null,
  })
}, { roles: rolesFor('infra:write') })
