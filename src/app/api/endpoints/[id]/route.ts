import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, ok, parseBody, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { getIp } from '@/lib/rate-limit'
import { audit, logEvent } from '@/lib/audit'

const HOSTNAME = /^[a-zA-Z0-9]([a-zA-Z0-9.\-]{0,251}[a-zA-Z0-9])?$/
const PROTOCOLS = ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS', 'HTTPS', 'HTTP', 'TCP'] as const

const patchSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  address: z.string().min(3).max(253).regex(HOSTNAME, 'Invalid address').optional(),
  port: z.number().int().min(1).max(65535).optional(),
  protocol: z.enum(PROTOCOLS).optional(),
  tls: z.boolean().optional(),
  sni: z.string().max(253).optional().or(z.literal('')),
  serverId: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
})

export const PATCH = withAuth<{ id: string }>(async (req, ctx) => {
  const body = await parseBody(req, patchSchema)
  const endpoint = await db.endpoint.findUnique({ where: { id: ctx.params.id } })
  if (!endpoint) throw new ApiError(404, 'NOT_FOUND', 'Endpoint not found.')

  await db.endpoint.update({
    where: { id: endpoint.id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.address ? { address: body.address } : {}),
      ...(body.port ? { port: body.port } : {}),
      ...(body.protocol ? { protocol: body.protocol } : {}),
      ...(body.tls !== undefined ? { tls: body.tls } : {}),
      ...(body.sni !== undefined ? { sni: body.sni || null } : {}),
      ...(body.serverId !== undefined ? { serverId: body.serverId || null } : {}),
      ...(body.enabled !== undefined ? { enabled: body.enabled, status: 'UNKNOWN' as const } : {}),
    },
  })

  await audit({
    actorId: ctx.auth.id,
    actorLabel: ctx.auth.username,
    action: body.enabled !== undefined ? (body.enabled ? 'ENDPOINT_ENABLE' : 'ENDPOINT_DISABLE') : 'ENDPOINT_UPDATE',
    resourceType: 'ENDPOINT',
    resourceId: endpoint.id,
    ip: getIp(req),
  })
  return ok({ updated: true })
}, { roles: rolesFor('infra:write') })

export const DELETE = withAuth<{ id: string }>(async (_req, ctx) => {
  const endpoint = await db.endpoint.findUnique({ where: { id: ctx.params.id } })
  if (!endpoint) throw new ApiError(404, 'NOT_FOUND', 'Endpoint not found.')

  await db.endpoint.delete({ where: { id: endpoint.id } })
  await Promise.all([
    audit({
      actorId: ctx.auth.id,
      actorLabel: ctx.auth.username,
      action: 'ENDPOINT_DELETE',
      resourceType: 'ENDPOINT',
      resourceId: endpoint.id,
      metadata: { name: endpoint.name },
    }),
    logEvent({
      level: 'WARN',
      action: 'ENDPOINT_DELETE',
      actor: ctx.auth.username,
      userId: ctx.auth.id,
      resourceType: 'ENDPOINT',
      resourceId: endpoint.id,
      message: `Deleted endpoint "${endpoint.name}"`,
    }),
  ])
  return ok({ deleted: true })
}, { roles: rolesFor('infra:write') })
