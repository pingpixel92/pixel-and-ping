import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, ok, parseBody, searchParams, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { getIp } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'

// ───────────────────────── GET /api/failover ─────────────────────────

export const GET = withAuth(async (_req) => {
  const rules = await db.failoverRule.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      primaryEndpoint: { select: { id: true, name: true, address: true, port: true, status: true } },
      backupEndpoint: { select: { id: true, name: true, address: true, port: true, status: true } },
    },
  })
  return ok({
    items: rules.map((r) => ({
      ...r,
      lastCheckedAt: r.lastCheckedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  })
}, { roles: rolesFor('infra:read') })

// ───────────────────────── POST /api/failover ─────────────────────────

const createSchema = z.object({
  name: z.string().min(2).max(100),
  primaryEndpointId: z.string().min(1),
  backupEndpointId: z.string().min(1),
  checkIntervalSec: z.number().int().min(30).max(86400).default(60),
  failureThreshold: z.number().int().min(1).max(100).default(3),
  recoveryThreshold: z.number().int().min(1).max(100).default(2),
  enabled: z.boolean().default(true),
})

export const POST = withAuth(async (req, ctx) => {
  const body = await parseBody(req, createSchema)
  if (body.primaryEndpointId === body.backupEndpointId) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Primary and backup endpoints must differ.')
  }
  const [primary, backup] = await Promise.all([
    db.endpoint.findUnique({ where: { id: body.primaryEndpointId } }),
    db.endpoint.findUnique({ where: { id: body.backupEndpointId } }),
  ])
  if (!primary || !backup) throw new ApiError(422, 'VALIDATION_ERROR', 'Selected endpoints do not exist.')

  const rule = await db.failoverRule.create({ data: body })
  await audit({
    actorId: ctx.auth.id,
    actorLabel: ctx.auth.username,
    action: 'FAILOVER_CREATE',
    resourceType: 'FAILOVER',
    resourceId: rule.id,
    ip: getIp(req),
    metadata: { name: rule.name },
  })
  return ok({ id: rule.id })
}, { roles: rolesFor('infra:write') })
