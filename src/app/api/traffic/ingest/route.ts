import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, fail, ok, parseBody } from '@/lib/api'
import { generateApiKey, safeEqualHex, sha256 } from '@/lib/crypto'
import { rateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

/**
 * POST /api/traffic/ingest — API-key authenticated traffic ingest.
 * Designed for real data-plane exporters (e.g. xray usage APIs) to push usage records.
 *
 * Authorization: Bearer ppk_… (permission: traffic:ingest)
 */

const recordSchema = z.object({
  at: z.string().datetime().optional(),
  vpnUserId: z.string().optional(),
  serverId: z.string().optional(),
  endpointId: z.string().optional(),
  bytesIn: z.number().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  bytesOut: z.number().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  requests: z.number().int().min(0).default(0),
})

const bodySchema = z.object({
  records: z.array(recordSchema).min(1).max(1000),
})

function extractKey(req: Request): string | null {
  const header = req.headers.get('authorization') ?? ''
  if (!header.toLowerCase().startsWith('bearer ')) return null
  const key = header.slice(7).trim()
  return key.startsWith('ppk_') ? key : null
}

export async function POST(req: Request) {
  try {
    const key = extractKey(req)
    if (!key) throw new ApiError(401, 'UNAUTHENTICATED', 'Provide an API key via Authorization: Bearer header.')

    if (!rateLimit(`ingest:${sha256(key).slice(0, 16)}`, 120, 60_000)) {
      throw new ApiError(429, 'RATE_LIMITED', 'Ingest rate limit reached.')
    }

    const apiKey = await db.apiKey.findUnique({ where: { keyHash: sha256(key) } })
    if (!apiKey || apiKey.revokedAt || (apiKey.expiresAt && apiKey.expiresAt < new Date())) {
      throw new ApiError(401, 'INVALID_API_KEY', 'API key is invalid, revoked or expired.')
    }
    const permissions = Array.isArray(apiKey.permissions) ? (apiKey.permissions as string[]) : []
    if (!permissions.includes('traffic:ingest')) {
      throw new ApiError(403, 'FORBIDDEN', 'API key lacks the traffic:ingest permission.')
    }

    const body = await parseBody(req as never, bodySchema)

    await db.$transaction(async (tx) => {
      await tx.trafficRecord.createMany({
        data: body.records.map((r) => ({
          ...(r.at ? { at: new Date(r.at) } : {}),
          vpnUserId: r.vpnUserId || null,
          serverId: r.serverId || null,
          endpointId: r.endpointId || null,
          bytesIn: BigInt(Math.round(r.bytesIn)),
          bytesOut: BigInt(Math.round(r.bytesOut)),
          requests: r.requests,
          source: 'ingest',
        })),
      })
      // Roll usage up to the vpn users.
      const perUser = new Map<string, bigint>()
      for (const r of body.records) {
        if (r.vpnUserId) {
          const add = BigInt(Math.round(r.bytesIn + r.bytesOut))
          perUser.set(r.vpnUserId, (perUser.get(r.vpnUserId) ?? BigInt(0)) + add)
        }
      }
      for (const [vpnUserId, bytes] of perUser) {
        await tx.vpnUser.update({ where: { id: vpnUserId }, data: { usedBytes: { increment: bytes } } }).catch(() => undefined)
      }
    })

    await db.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    return ok({ ingested: body.records.length })
  } catch (err) {
    if (err instanceof ApiError) {
      logger.warn('Ingest rejected', { code: err.code })
      return fail(err.status, err.code, err.message)
    }
    logger.error('Ingest failed', { err: err instanceof Error ? err.message : String(err) })
    return fail(500, 'INTERNAL_ERROR', 'Ingest failed.')
  }
}
