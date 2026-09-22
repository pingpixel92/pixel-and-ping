import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, ok, parseBody, searchParams, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { getIp } from '@/lib/rate-limit'
import { generateConfigFor } from '@/lib/services/users.service'
import { auditVpnUser } from '@/lib/services/users.service'
import { logEvent } from '@/lib/audit'

const PROTOCOLS = ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS', 'HTTPS', 'HTTP', 'TCP'] as const

// ───────────────────────── GET /api/users (list) ─────────────────────────

export const GET = withAuth(async (req) => {
  const sp = searchParams(req)
  const page = Math.max(1, Number(sp.get('page') ?? 1))
  const pageSize = Math.min(100, Math.max(5, Number(sp.get('pageSize') ?? 10)))
  const search = (sp.get('search') ?? '').trim().slice(0, 100)
  const status = sp.get('status') ?? 'ALL'
  const serverId = sp.get('serverId') ?? ''
  const sort = sp.get('sort') ?? 'createdAt'
  const order = sp.get('order') === 'asc' ? 'asc' : 'desc'

  // Lazy expiry sync — keeps stored status consistent with time.
  await db.vpnUser.updateMany({
    where: { status: 'ACTIVE', expiresAt: { lt: new Date(), not: null } },
    data: { status: 'EXPIRED' },
  })

  const now = new Date()
  const statusWhere =
    status === 'ACTIVE'
      ? { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }], NOT: { status: 'DISABLED' as const } }
      : status === 'DISABLED'
        ? { status: 'DISABLED' as const }
        : status === 'EXPIRED'
          ? { status: 'EXPIRED' as const }
          : status === 'EXPIRING_SOON'
            ? { NOT: { status: 'DISABLED' as const }, expiresAt: { gt: now, lte: new Date(now.getTime() + 7 * 86_400_000) } }
            : {}

  const where = {
    AND: [
      statusWhere,
      serverId ? { serverId } : {},
      search
        ? {
            OR: [
              { username: { contains: search, mode: 'insensitive' as const } },
              { displayName: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {},
    ],
  }

  const orderBy =
    sort === 'username' ? { username: order } : sort === 'expiresAt' ? { expiresAt: order } : { createdAt: order }

  const [total, items] = await Promise.all([
    db.vpnUser.count({ where }),
    db.vpnUser.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        server: { select: { id: true, name: true } },
        endpoint: { select: { id: true, name: true } },
        port: { select: { id: true, number: true } },
      },
    }),
  ])

  return ok({
    items: items.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      email: u.email,
      status: u.status,
      protocol: u.protocol,
      hasConfig: Boolean(u.config),
      server: u.server ? { id: u.server.id, name: u.server.name } : null,
      endpoint: u.endpoint ? { id: u.endpoint.id, name: u.endpoint.name } : null,
      port: u.port ? { id: u.port.id, number: u.port.number } : null,
      expiresAt: u.expiresAt?.toISOString() ?? null,
      trafficLimitBytes: u.trafficLimitBytes !== null ? u.trafficLimitBytes.toString() : null,
      usedBytes: u.usedBytes.toString(),
      notes: u.notes,
      createdAt: u.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  })
}, { roles: rolesFor('users:read') })

// ───────────────────────── POST /api/users (create) ─────────────────────────

const createSchema = z.object({
  username: z
    .string()
    .regex(/^[a-zA-Z0-9._-]{3,32}$/, '3–32 chars: letters, digits, . _ -')
    .transform((v) => v.toLowerCase()),
  displayName: z.string().max(100).optional().or(z.literal('')),
  email: z.string().email().max(255).optional().or(z.literal('')),
  protocol: z.enum(PROTOCOLS),
  serverId: z.string().optional().or(z.literal('')),
  endpointId: z.string().optional().or(z.literal('')),
  portId: z.string().optional().or(z.literal('')),
  unlimitedExpiry: z.boolean().default(true),
  expiresAt: z.string().datetime().nullable().optional(),
  unlimitedTraffic: z.boolean().default(true),
  trafficLimitGb: z.number().positive().max(1_000_000).nullable().optional(),
  notes: z.string().max(2000).optional().or(z.literal('')),
})

export const POST = withAuth(async (req, ctx) => {
  const body = await parseBody(req, createSchema)
  const ip = getIp(req)

  const existing = await db.vpnUser.findUnique({ where: { username: body.username } })
  if (existing) throw new ApiError(409, 'CONFLICT', `Username "${body.username}" is already taken.`)

  // Validate infrastructure references exist.
  if (body.serverId) {
    const server = await db.server.findUnique({ where: { id: body.serverId } })
    if (!server) throw new ApiError(422, 'VALIDATION_ERROR', 'Selected server does not exist.')
  }
  if (body.endpointId) {
    const endpoint = await db.endpoint.findUnique({ where: { id: body.endpointId } })
    if (!endpoint) throw new ApiError(422, 'VALIDATION_ERROR', 'Selected endpoint does not exist.')
  }
  if (body.portId) {
    const port = await db.port.findUnique({ where: { id: body.portId } })
    if (!port) throw new ApiError(422, 'VALIDATION_ERROR', 'Selected port does not exist.')
  }

  const vpnUser = await db.vpnUser.create({
    data: {
      username: body.username,
      displayName: body.displayName || null,
      email: body.email ? body.email.toLowerCase() : null,
      protocol: body.protocol,
      serverId: body.serverId || null,
      endpointId: body.endpointId || null,
      portId: body.portId || null,
      expiresAt: !body.unlimitedExpiry && body.expiresAt ? new Date(body.expiresAt) : null,
      trafficLimitBytes:
        !body.unlimitedTraffic && body.trafficLimitGb
          ? BigInt(Math.round(body.trafficLimitGb * 1024 ** 3))
          : null,
      notes: body.notes || null,
      createdById: ctx.auth.id,
    },
  })

  // Best-effort config generation — a warning is returned when infra is missing.
  let warning: string | null = null
  try {
    await generateConfigFor(vpnUser.id)
  } catch (err) {
    warning = err instanceof ApiError ? err.message : 'Configuration generation failed.'
  }

  await auditVpnUser('VPN_USER_CREATE', { id: ctx.auth.id, label: ctx.auth.username }, vpnUser.id, vpnUser.username, ip)
  await logEvent({
    action: 'VPN_USER_CREATE',
    actor: ctx.auth.username,
    userId: ctx.auth.id,
    resourceType: 'VPN_USER',
    resourceId: vpnUser.id,
    message: `Created user "${vpnUser.username}" (${vpnUser.protocol})`,
    ip,
  })

  return ok({ id: vpnUser.id, warning })
}, { roles: rolesFor('users:write') })
