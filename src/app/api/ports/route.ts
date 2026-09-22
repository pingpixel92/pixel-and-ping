import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, ok, parseBody, searchParams, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { getIp } from '@/lib/rate-limit'
import { audit, logEvent } from '@/lib/audit'

const PROTOCOLS = ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS', 'HTTPS', 'HTTP', 'TCP'] as const

// ───────────────────────── GET /api/ports ─────────────────────────

export const GET = withAuth(async (req) => {
  const sp = searchParams(req)
  const page = Math.max(1, Number(sp.get('page') ?? 1))
  const pageSize = Math.min(100, Math.max(5, Number(sp.get('pageSize') ?? 50)))
  const search = (sp.get('search') ?? '').trim().slice(0, 100)

  const where = search && /^\d+$/.test(search) ? { number: Number(search) } : {}

  const [total, items] = await Promise.all([
    db.port.count({ where }),
    db.port.findMany({
      where,
      orderBy: [{ number: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { server: { select: { id: true, name: true } }, _count: { select: { vpnUsers: true } } },
    }),
  ])

  return ok({
    items: items.map((p) => ({
      id: p.id,
      number: p.number,
      protocol: p.protocol,
      tls: p.tls,
      note: p.note,
      status: p.status,
      latencyMs: p.latencyMs,
      lastCheckAt: p.lastCheckAt?.toISOString() ?? null,
      server: p.server,
      vpnUsers: p._count.vpnUsers,
      createdAt: p.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  })
}, { roles: rolesFor('infra:read') })

// ───────────────────────── POST /api/ports ─────────────────────────

const createSchema = z.object({
  number: z.number().int().min(1).max(65535),
  protocol: z.enum(PROTOCOLS),
  tls: z.boolean().default(true),
  note: z.string().max(500).optional().or(z.literal('')),
  serverId: z.string().optional().or(z.literal('')),
})

export const POST = withAuth(async (req, ctx) => {
  const body = await parseBody(req, createSchema)
  const ip = getIp(req)

  if (body.serverId) {
    const server = await db.server.findUnique({ where: { id: body.serverId } })
    if (!server) throw new ApiError(422, 'VALIDATION_ERROR', 'Selected server does not exist.')
  }

  const duplicate = await db.port.findFirst({
    where: { number: body.number, protocol: body.protocol, serverId: body.serverId || null },
  })
  if (duplicate) {
    throw new ApiError(409, 'CONFLICT', `Port ${body.number}/${body.protocol} already exists for this scope.`)
  }

  const port = await db.port.create({
    data: {
      number: body.number,
      protocol: body.protocol,
      tls: body.tls,
      note: body.note || null,
      serverId: body.serverId || null,
    },
  })

  await audit({
    actorId: ctx.auth.id,
    actorLabel: ctx.auth.username,
    action: 'PORT_CREATE',
    resourceType: 'PORT',
    resourceId: port.id,
    ip,
    metadata: { number: port.number, protocol: port.protocol },
  })
  await logEvent({
    action: 'PORT_CREATE',
    actor: ctx.auth.username,
    userId: ctx.auth.id,
    resourceType: 'PORT',
    resourceId: port.id,
    message: `Added port ${port.number}/${port.protocol}${port.tls ? ' (TLS)' : ''}`,
    ip,
  })

  return ok({ id: port.id })
}, { roles: rolesFor('infra:write') })
