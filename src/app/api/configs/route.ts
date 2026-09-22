import { z } from 'zod'
import { db } from '@/lib/db'
import { ok, parseBody, searchParams, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { getIp } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { getProvider, ProviderNotConfiguredError } from '@/lib/services/providers'

// ───────────────────────── GET /api/configs (saved configs) ─────────────────────────

export const GET = withAuth(async (req) => {
  const sp = searchParams(req)
  const page = Math.max(1, Number(sp.get('page') ?? 1))
  const pageSize = Math.min(100, Math.max(5, Number(sp.get('pageSize') ?? 10)))
  const search = (sp.get('search') ?? '').trim().slice(0, 100)

  const where = search
    ? { name: { contains: search, mode: 'insensitive' as const } }
    : {}

  const [total, items] = await Promise.all([
    db.config.count({ where }),
    db.config.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { vpnUser: { select: { username: true } } },
    }),
  ])

  return ok({
    items: items.map((c) => ({
      id: c.id,
      name: c.name,
      protocol: c.protocol,
      content: c.content,
      vpnUser: c.vpnUser?.username ?? null,
      createdAt: c.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  })
}, { roles: rolesFor('users:read') })

// ───────────────────────── POST /api/configs (generate) ─────────────────────────

const generateSchema = z.object({
  displayName: z.string().min(1).max(100),
  protocol: z.enum(['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS', 'HTTPS', 'HTTP', 'TCP']),
  host: z.string().min(3).max(253),
  port: z.number().int().min(1).max(65535),
  tls: z.boolean().default(true),
  sni: z.string().max(253).optional().or(z.literal('')),
  save: z.boolean().default(true),
})

export const POST = withAuth(async (req, ctx) => {
  const body = await parseBody(req, generateSchema)
  const provider = getProvider(body.protocol)

  try {
    const credentials = provider.createCredentials()
    const content = provider.buildConfig({
      username: body.displayName,
      displayName: body.displayName,
      host: body.host,
      port: body.port,
      tls: body.tls,
      sni: body.sni || null,
      credentials,
    })

    let id: string | null = null
    if (body.save) {
      const created = await db.config.create({
        data: {
          name: `${body.displayName}-${body.protocol.toLowerCase()}-${Date.now().toString(36)}`,
          protocol: body.protocol,
          content,
        },
      })
      id = created.id
      await audit({
        actorId: ctx.auth.id,
        actorLabel: ctx.auth.username,
        action: 'CONFIG_GENERATE',
        resourceType: 'CONFIG',
        resourceId: created.id,
        ip: getIp(req),
        metadata: { protocol: body.protocol, host: body.host, port: body.port },
      })
    }
    return ok({ id, protocol: body.protocol, content, providerImplemented: true })
  } catch (err) {
    if (err instanceof ProviderNotConfiguredError) {
      return ok({ protocol: body.protocol, content: null, providerImplemented: false, message: err.message })
    }
    throw err
  }
}, { roles: rolesFor('users:write') })
