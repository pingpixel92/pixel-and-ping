import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, ok, parseBody, searchParams, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { getIp } from '@/lib/rate-limit'
import { audit, logEvent } from '@/lib/audit'

const IP_OR_HOST = /^[a-zA-Z0-9][a-zA-Z0-9.\-:]{2,253}$/

// ───────────────────────── GET /api/servers ─────────────────────────

export const GET = withAuth(async (req) => {
  const sp = searchParams(req)
  const page = Math.max(1, Number(sp.get('page') ?? 1))
  const pageSize = Math.min(100, Math.max(5, Number(sp.get('pageSize') ?? 50)))
  const search = (sp.get('search') ?? '').trim().slice(0, 100)

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { host: { contains: search, mode: 'insensitive' as const } },
          { ip: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [total, items] = await Promise.all([
    db.server.count({ where }),
    db.server.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: { select: { vpnUsers: true, endpoints: true, ports: true } },
      },
    }),
  ])

  return ok({
    items: items.map((s) => ({
      id: s.id,
      name: s.name,
      host: s.host,
      ip: s.ip,
      provider: s.provider,
      location: s.location,
      notes: s.notes,
      status: s.status,
      latencyMs: s.latencyMs,
      lastCheckAt: s.lastCheckAt?.toISOString() ?? null,
      lastError: s.lastError,
      vpnUsers: s._count.vpnUsers,
      endpoints: s._count.endpoints,
      ports: s._count.ports,
      createdAt: s.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  })
}, { roles: rolesFor('infra:read') })

// ───────────────────────── POST /api/servers ─────────────────────────

const createSchema = z.object({
  name: z.string().min(2).max(100),
  host: z.string().min(3).max(253).regex(IP_OR_HOST, 'Invalid host'),
  ip: z.string().max(45).optional().or(z.literal('')),
  provider: z.string().max(100).optional().or(z.literal('')),
  location: z.string().max(100).optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
})

export const POST = withAuth(async (req, ctx) => {
  const body = await parseBody(req, createSchema)
  const ip = getIp(req)

  const existing = await db.server.findUnique({ where: { name: body.name } })
  if (existing) throw new ApiError(409, 'CONFLICT', `Server name "${body.name}" already exists.`)

  const server = await db.server.create({
    data: {
      name: body.name,
      host: body.host,
      ip: body.ip || null,
      provider: body.provider || null,
      location: body.location || null,
      notes: body.notes || null,
    },
  })

  await audit({
    actorId: ctx.auth.id,
    actorLabel: ctx.auth.username,
    action: 'SERVER_CREATE',
    resourceType: 'SERVER',
    resourceId: server.id,
    ip,
    metadata: { name: server.name },
  })
  await logEvent({
    action: 'SERVER_CREATE',
    actor: ctx.auth.username,
    userId: ctx.auth.id,
    resourceType: 'SERVER',
    resourceId: server.id,
    message: `Added server "${server.name}" (${server.host})`,
    ip,
  })

  return ok({ id: server.id })
}, { roles: rolesFor('infra:write') })
