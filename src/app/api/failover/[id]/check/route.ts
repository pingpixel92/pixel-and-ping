import { db } from '@/lib/db'
import { ApiError, ok, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { evaluateRule } from '@/lib/services/failover.service'

/** POST /api/failover/:id/check — run a real evaluation of the rule now. */
export const POST = withAuth<{ id: string }>(async (_req, ctx) => {
  const rule = await db.failoverRule.findUnique({ where: { id: ctx.params.id } })
  if (!rule) throw new ApiError(404, 'NOT_FOUND', 'Failover rule not found.')

  await evaluateRule(rule.id)
  const updated = await db.failoverRule.findUnique({
    where: { id: rule.id },
    include: {
      primaryEndpoint: { select: { id: true, name: true, status: true } },
      backupEndpoint: { select: { id: true, name: true, status: true } },
    },
  })
  return ok({
    rule: updated
      ? { ...updated, lastCheckedAt: updated.lastCheckedAt?.toISOString() ?? null, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() }
      : null,
  })
}, { roles: rolesFor('infra:write') })
