import { z } from 'zod'
import { db } from '@/lib/db'
import { ok, parseBody, searchParams, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { getIp } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { generateApiKey } from '@/lib/crypto'

export const GET = withAuth(async (_req, ctx) => {
  const sp = searchParams(_req)
  const includeRevoked = sp.get('includeRevoked') === '1'
  const items = await db.apiKey.findMany({
    where: includeRevoked ? {} : { revokedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { createdBy: { select: { username: true } } },
  })
  return ok({
    items: items.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      permissions: k.permissions,
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      expiresAt: k.expiresAt?.toISOString() ?? null,
      revokedAt: k.revokedAt?.toISOString() ?? null,
      createdBy: k.createdBy?.username ?? null,
      createdAt: k.createdAt.toISOString(),
    })),
    actor: ctx.auth.username,
  })
}, { roles: rolesFor('apikeys:manage') })

const PERMISSION_VALUES = ['traffic:ingest'] as const

const createSchema = z.object({
  name: z.string().min(2).max(100),
  permissions: z.array(z.enum(PERMISSION_VALUES)).min(1),
  expiresInDays: z.number().int().min(1).max(3650).nullable().optional(),
})

export const POST = withAuth(async (req, ctx) => {
  const body = await parseBody(req, createSchema)

  const generated = generateApiKey()
  const apiKey = await db.apiKey.create({
    data: {
      name: body.name,
      prefix: generated.prefix,
      keyHash: generated.keyHash,
      permissions: body.permissions as never,
      expiresAt: body.expiresInDays ? new Date(Date.now() + body.expiresInDays * 86_400_000) : null,
      createdById: ctx.auth.id,
    },
  })

  await audit({
    actorId: ctx.auth.id,
    actorLabel: ctx.auth.username,
    action: 'API_KEY_CREATE',
    resourceType: 'API_KEY',
    resourceId: apiKey.id,
    ip: getIp(req),
    metadata: { name: apiKey.name, prefix: apiKey.prefix },
  })

  // The full key is returned exactly once and never stored in plaintext.
  return ok({
    id: apiKey.id,
    name: apiKey.name,
    prefix: apiKey.prefix,
    permissions: body.permissions,
    key: generated.key,
    createdAt: apiKey.createdAt.toISOString(),
  })
}, { roles: rolesFor('apikeys:manage') })
