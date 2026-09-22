import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, ok, parseBody, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { getIp } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'

const patchSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  primaryEndpointId: z.string().min(1).optional(),
  backupEndpointId: z.string().min(1).optional(),
  checkIntervalSec: z.number().int().min(30).max(86400).optional(),
  failureThreshold: z.number().int().min(1).max(100).optional(),
  recoveryThreshold: z.number().int().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
})

export const PATCH = withAuth<{ id: string }>(async (req, ctx) => {
  const body = await parseBody(req, patchSchema)
  const rule = await db.failoverRule.findUnique({ where: { id: ctx.params.id } })
  if (!rule) throw new ApiError(404, 'NOT_FOUND', 'Failover rule not found.')

  const primaryId = body.primaryEndpointId ?? rule.primaryEndpointId
  const backupId = body.backupEndpointId ?? rule.backupEndpointId
  if (primaryId === backupId) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Primary and backup endpoints must differ.')
  }

  await db.failoverRule.update({
    where: { id: rule.id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.primaryEndpointId ? { primaryEndpointId: body.primaryEndpointId } : {}),
      ...(body.backupEndpointId ? { backupEndpointId: body.backupEndpointId } : {}),
      ...(body.checkIntervalSec ? { checkIntervalSec: body.checkIntervalSec } : {}),
      ...(body.failureThreshold ? { failureThreshold: body.failureThreshold } : {}),
      ...(body.recoveryThreshold ? { recoveryThreshold: body.recoveryThreshold } : {}),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
    },
  })
  await audit({
    actorId: ctx.auth.id,
    actorLabel: ctx.auth.username,
    action: 'FAILOVER_UPDATE',
    resourceType: 'FAILOVER',
    resourceId: rule.id,
    ip: getIp(req),
  })
  return ok({ updated: true })
}, { roles: rolesFor('infra:write') })

export const DELETE = withAuth<{ id: string }>(async (_req, ctx) => {
  const rule = await db.failoverRule.findUnique({ where: { id: ctx.params.id } })
  if (!rule) throw new ApiError(404, 'NOT_FOUND', 'Failover rule not found.')
  await db.failoverRule.delete({ where: { id: rule.id } })
  await audit({
    actorId: ctx.auth.id,
    actorLabel: ctx.auth.username,
    action: 'FAILOVER_DELETE',
    resourceType: 'FAILOVER',
    resourceId: rule.id,
  })
  return ok({ deleted: true })
}, { roles: rolesFor('infra:write') })
