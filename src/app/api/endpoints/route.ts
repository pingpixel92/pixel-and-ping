import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, ok, parseBody, searchParams, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { getIp } from '@/lib/rate-limit'
import { audit, logEvent } from '@/lib/audit'

const HOSTNAME = /^[a-zA-Z0-9]([a-zA-Z0-9.\-]{0,251}[a-zA-Z0-9])?$/
const PROTOCOLS = ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS', 'HTTPS', 'HTTP', 'TCP'] as const

// ───────────────────────── GET /api/endpoints ─────────────────────────

export const GET = withAuth(async (req) => {
  const sp = searchParams(req)
  const page = Math.max(1, Number(sp.get('page') ?? 1))
  const pageSize = Math.min(100, Math.max(5, Number(sp.get('pageSize') ?? 50)))
  const search = (sp.get('search') ?? '').trim().slice(0, 100)

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { address: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [total, items] = await Promise.all([
    db.endpoint.count({ where }),
    db.endpoint.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { server: { select: { id: true, name: true } }, _count: { select: { vpnUsers: true } } },
    }),
  ])

  return ok({
    items: items.map((e) => ({
      id: e.id,
      name: e.name,
      address: e.address,
      port: e.port,
      protocol: e.protocol,
      tls: e.tls,
      sni: e.sni,
      enabled: e.enabled,
      status: e.enabled ? e.status : 'UNKNOWN',
      latencyMs: e.latencyMs,
      lastCheckAt: e.lastCheckAt?.toISOString() ?? null,
      lastError: e.lastError,
      server: e.server,
      vpnUsers: e._count.vpnUsers,
      createdAt: e.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  })
}, { roles: rolesFor('infra:read') })

// ───────────────────────── POST /api/endpoints ─────────────────────────

const createSchema = z.object({
  name: z.string().min(2).max(100),
  address: z.string().min(3).max(253).regex(HOSTNAME, 'Invalid address'),
  port: z.number().int().min(1).max(65535),
  protocol: z.enum(PROTOCOLS),
  tls: z.boolean().default(true),
  sni: z.string().max(253).optional().or(z.literal('')),
  serverId: z.string().optional().or(z.literal('')),
  enabled: z.boolean().default(true),
})

export const POST = withAuth(async (req, ctx) => {
  const body = await parseBody(req, createSchema)
  const ip = getIp(req)

  if (body.serverId) {
    const server = await db.server.findUnique({ where: { id: body.serverId } })
    if (!server) throw new ApiError(422, 'VALIDATION_ERROR', 'Selected server does not exist.')
  }

  const endpoint = await db.endpoint.create({
    data: {
      name: body.name,
      address: body.address,
      port: body.port,
      protocol: body.protocol,
      tls: body.tls,
      sni: body.sni || null,
      serverId: body.serverId || null,
      enabled: body.enabled,
    },
  })

  await audit({
    actorId: ctx.auth.id,
    actorLabel: ctx.auth.username,
    action: 'ENDPOINT_CREATE',
    resourceType: 'ENDPOINT',
    resourceId: endpoint.id,
    ip,
    metadata: { name: endpoint.name },
  })
  await logEvent({
    action: 'ENDPOINT_CREATE',
    actor: ctx.auth.username,
    userId: ctx.auth.id,
    resourceType: 'ENDPOINT',
    resourceId: endpoint.id,
    message: `Added endpoint "${endpoint.name}" (${endpoint.address}:${endpoint.port})`,
    ip,
  })

  return ok({ id: endpoint.id })
}, { roles: rolesFor('infra:write') })
