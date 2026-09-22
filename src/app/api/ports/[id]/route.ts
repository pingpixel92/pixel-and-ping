import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, ok, parseBody, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { getIp } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'

const PROTOCOLS = ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS', 'HTTPS', 'HTTP', 'TCP'] as const

const patchSchema = z.object({
  number: z.number().int().min(1).max(65535).optional(),
  protocol: z.enum(PROTOCOLS).optional(),
  tls: z.boolean().optional(),
  note: z.string().max(500).optional().or(z.literal('')),
  serverId: z.string().nullable().optional(),
})

export const PATCH = withAuth<{ id: string }>(async (req, ctx) => {
  const body = await parseBody(req, patchSchema)
  const port = await db.port.findUnique({ where: { id: ctx.params.id } })
  if (!port) throw new ApiError(404, 'NOT_FOUND', 'Port not found.')

  await db.port.update({
    where: { id: port.id },
    data: {
      ...(body.number ? { number: body.number } : {}),
      ...(body.protocol ? { protocol: body.protocol } : {}),
      ...(body.tls !== undefined ? { tls: body.tls } : {}),
      ...(body.note !== undefined ? { note: body.note || null } : {}),
      ...(body.serverId !== undefined ? { serverId: body.serverId || null } : {}),
    },
  })
  await audit({
    actorId: ctx.auth.id,
    actorLabel: ctx.auth.username,
    action: 'PORT_UPDATE',
    resourceType: 'PORT',
    resourceId: port.id,
    ip: getIp(req),
  })
  return ok({ updated: true })
}, { roles: rolesFor('infra:write') })

export const DELETE = withAuth<{ id: string }>(async (_req, ctx) => {
  const port = await db.port.findUnique({ where: { id: ctx.params.id } })
  if (!port) throw new ApiError(404, 'NOT_FOUND', 'Port not found.')

  await db.port.delete({ where: { id: port.id } })
  await audit({
    actorId: ctx.auth.id,
    actorLabel: ctx.auth.username,
    action: 'PORT_DELETE',
    resourceType: 'PORT',
    resourceId: port.id,
    metadata: { number: port.number },
  })
  return ok({ deleted: true })
}, { roles: rolesFor('infra:write') })
