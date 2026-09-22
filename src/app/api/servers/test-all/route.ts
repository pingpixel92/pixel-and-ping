import { db } from '@/lib/db'
import { ok, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { runAllHealthChecks } from '@/lib/services/health.service'

/** POST /api/servers/test-all — refreshes every server & endpoint status with real checks. */
export const POST = withAuth(async () => {
  const summary = await runAllHealthChecks()
  const servers = await db.server.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, status: true, latencyMs: true, lastCheckAt: true },
  })
  return ok({
    summary,
    servers: servers.map((s) => ({ ...s, lastCheckAt: s.lastCheckAt?.toISOString() ?? null })),
  })
}, { roles: rolesFor('infra:write') })
