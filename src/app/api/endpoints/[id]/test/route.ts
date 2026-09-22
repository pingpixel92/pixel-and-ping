import { db } from '@/lib/db'
import { ok, withAuth, ApiError } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { checkEndpointById } from '@/lib/services/health.service'
import { getIp, rateLimit } from '@/lib/rate-limit'
import { logEvent } from '@/lib/audit'

export const POST = withAuth<{ id: string }>(async (req, ctx) => {
  if (!rateLimit(`endpoint-test:${ctx.auth.id}`, 30, 60_000)) {
    throw new ApiError(429, 'RATE_LIMITED', 'Too many checks. Wait a moment.')
  }
  const endpoint = await db.endpoint.findUnique({ where: { id: ctx.params.id } })
  if (!endpoint) throw new ApiError(404, 'NOT_FOUND', 'Endpoint not found.')

  const result = await checkEndpointById(endpoint.id)
  await logEvent({
    level: result.ok ? 'INFO' : 'WARN',
    action: 'ENDPOINT_TEST',
    actor: ctx.auth.username,
    userId: ctx.auth.id,
    resourceType: 'ENDPOINT',
    resourceId: endpoint.id,
    message: result.ok
      ? `Endpoint "${endpoint.name}" is online (${result.latencyMs} ms)`
      : `Endpoint "${endpoint.name}" check failed: ${result.error}`,
    ip: getIp(req),
  })

  const updated = await db.endpoint.findUnique({ where: { id: endpoint.id } })
  return ok({
    ok: result.ok,
    latencyMs: result.latencyMs,
    error: result.error ?? null,
    status: updated?.status ?? 'UNKNOWN',
    checkedAt: updated?.lastCheckAt?.toISOString() ?? null,
  })
}, { roles: rolesFor('infra:write') })
