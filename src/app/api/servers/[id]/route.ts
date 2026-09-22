import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, ok, parseBody, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { getIp } from '@/lib/rate-limit'
import { audit, logEvent } from '@/lib/audit'

const IP_OR_HOST = /^[a-zA-Z0-9][a-zA-Z0-9.\-:]{2,253}$/

const patchSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  host: z.string().min(3).max(253).regex(IP_OR_HOST, 'Invalid host').optional(),
  ip: z.string().max(45).optional().or(z.literal('')),
  provider: z.string().max(100).optional().or(z.literal('')),
  location: z.string().max(100).optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
})

export const PATCH = withAuth<{ id: string }>(async (req, ctx) => {
  const body = await parseBody(req, patchSchema)
  const server = await db.server.findUnique({ where: { id: ctx.params.id } })
  if (!server) throw new ApiError(404, 'NOT_FOUND', 'Server not found.')

  if (body.name && body.name !== server.name) {
    const existing = await db.server.findUnique({ where: { name: body.name } })
    if (existing) throw new ApiError(409, 'CONFLICT', `Server name "${body.name}" already exists.`)
  }

  await db.server.update({
    where: { id: server.id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.host ? { host: body.host } : {}),
      ...(body.ip !== undefined ? { ip: body.ip || null } : {}),
      ...(body.provider !== undefined ? { provider: body.provider || null } : {}),
      ...(body.location !== undefined ? { location: body.location || null } : {}),
      ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
    },
  })

  await audit({
    actorId: ctx.auth.id,
    actorLabel: ctx.auth.username,
    action: 'SERVER_UPDATE',
    resourceType: 'SERVER',
    resourceId: server.id,
    ip: getIp(req),
  })
  return ok({ updated: true })
}, { roles: rolesFor('infra:write') })

export const DELETE = withAuth<{ id: string }>(async (_req, ctx) => {
  const server = await db.server.findUnique({ where: { id: ctx.params.id } })
  if (!server) throw new ApiError(404, 'NOT_FOUND', 'Server not found.')

  await db.server.delete({ where: { id: server.id } })
  await Promise.all([
    audit({
      actorId: ctx.auth.id,
      actorLabel: ctx.auth.username,
      action: 'SERVER_DELETE',
      resourceType: 'SERVER',
      resourceId: server.id,
      metadata: { name: server.name },
    }),
    logEvent({
      level: 'WARN',
      action: 'SERVER_DELETE',
      actor: ctx.auth.username,
      userId: ctx.auth.id,
      resourceType: 'SERVER',
      resourceId: server.id,
      message: `Deleted server "${server.name}"`,
    }),
  ])
  return ok({ deleted: true })
}, { roles: rolesFor('infra:write') })
