import { db } from '@/lib/db'
import { decryptSecret, encryptSecret, sha256 } from '@/lib/crypto'
import { ApiError } from '@/lib/api'
import { audit, trackEvent } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { pushNotification } from './notifications.service'

/**
 * Real Cloudflare API integration.
 * - Tokens are stored AES-256-GCM encrypted, never returned, never logged.
 * - Only aggregate status is exposed to the UI.
 */

const CF_BASE = 'https://api.cloudflare.com/client/v4'

interface CfEnvelope<T> {
  success: boolean
  errors: Array<{ code: number; message: string }>
  result: T
}

async function cfFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${CF_BASE}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err) {
    throw new ApiError(502, 'CLOUDFLARE_UNREACHABLE', 'Could not reach the Cloudflare API.')
  }
  const body = (await res.json().catch(() => null)) as CfEnvelope<T> | null
  if (!body) {
    throw new ApiError(502, 'CLOUDFLARE_BAD_RESPONSE', `Cloudflare returned an unreadable response (HTTP ${res.status}).`)
  }
  if (!body.success || res.status >= 400) {
    const message = body.errors?.[0]?.message ?? `Cloudflare request failed (HTTP ${res.status})`
    throw new ApiError(400, 'CLOUDFLARE_ERROR', message)
  }
  return body.result
}

export interface CfStatus {
  connected: boolean
  name: string | null
  verified: boolean
  zoneCount: number
  lastVerifiedAt: string | null
  connectedAt: string | null
}

export async function getStatus(): Promise<CfStatus> {
  const account = await db.cloudflareAccount.findFirst({ include: { _count: { select: { zones: true } } } })
  if (!account) {
    return { connected: false, name: null, verified: false, zoneCount: 0, lastVerifiedAt: null, connectedAt: null }
  }
  return {
    connected: true,
    name: account.name,
    verified: account.verified,
    zoneCount: account._count.zones,
    lastVerifiedAt: account.lastVerifiedAt?.toISOString() ?? null,
    connectedAt: account.createdAt.toISOString(),
  }
}

async function currentToken(): Promise<{ token: string; accountId: string } | null> {
  const account = await db.cloudflareAccount.findFirst()
  if (!account) return null
  try {
    return { token: decryptSecret(account.tokenCipher), accountId: account.id }
  } catch {
    logger.error('Cloudflare token decryption failed — key mismatch?')
    throw new ApiError(500, 'DECRYPT_FAILED', 'Stored Cloudflare credentials cannot be decrypted. Reconnect the account.')
  }
}

export async function connect(token: string, name: string, actor: { id: string; label: string }, ip: string | null): Promise<CfStatus> {
  // 1. Verify the token against the real Cloudflare API.
  const verify = await cfFetch<{ id: string; status: string }>('/user/tokens/verify', token)
  if (verify.status !== 'active') {
    throw new ApiError(400, 'CLOUDFLARE_TOKEN_INACTIVE', 'The Cloudflare token is not active.')
  }

  // 2. Fetch zones.
  const zones = await cfFetch<Array<{ id: string; name: string; status: string; account?: { id: string } }>>(
    '/zones?per_page=50',
    token,
  )

  // 3. Persist encrypted (single-account model; re-connect replaces).
  const tokenHash = sha256(token)
  const previous = await db.cloudflareAccount.findFirst()
  if (previous) await db.cloudflareAccount.delete({ where: { id: previous.id } })

  const account = await db.cloudflareAccount.create({
    data: {
      name,
      tokenCipher: encryptSecret(token),
      tokenHash,
      accountId: zones[0]?.account?.id ?? null,
      verified: true,
      lastVerifiedAt: new Date(),
    },
  })

  // 4. Import zones.
  for (const zone of zones) {
    await db.cloudflareZone.upsert({
      where: { zoneId: zone.id },
      create: { zoneId: zone.id, name: zone.name, status: zone.status, accountId: account.id },
      update: { name: zone.name, status: zone.status, accountId: account.id },
    })
  }

  await audit({
    actorId: actor.id,
    actorLabel: actor.label,
    action: 'CLOUDFLARE_CONNECT',
    resourceType: 'CLOUDFLARE_ACCOUNT',
    resourceId: account.id,
    ip,
    metadata: { name, zoneCount: zones.length },
  })
  await trackEvent({ type: 'INTEGRATION', source: 'api', message: `Cloudflare account "${name}" connected`, meta: { zoneCount: zones.length } })
  await pushNotification({
    type: 'INTEGRATION',
    title: 'Cloudflare connected',
    message: `Account "${name}" connected with ${zones.length} zone(s).`,
    dedupeKey: `cf:connect:${account.id}`,
  })

  return getStatus()
}

export async function disconnect(actor: { id: string; label: string }, ip: string | null): Promise<void> {
  const account = await db.cloudflareAccount.findFirst()
  if (!account) throw new ApiError(404, 'NOT_CONFIGURED', 'No Cloudflare account is connected.')
  await db.cloudflareAccount.delete({ where: { id: account.id } })
  await audit({
    actorId: actor.id,
    actorLabel: actor.label,
    action: 'CLOUDFLARE_DISCONNECT',
    resourceType: 'CLOUDFLARE_ACCOUNT',
    resourceId: account.id,
    ip,
  })
  await pushNotification({
    type: 'INTEGRATION',
    title: 'Cloudflare disconnected',
    message: 'The Cloudflare account and cached zones were removed.',
    dedupeKey: `cf:disconnect:${Date.now()}`,
  })
}

export interface CfZone {
  zoneId: string
  name: string
  status: string
  fetchedAt: string | null
}

export async function listZones(): Promise<CfZone[]> {
  const ctx = await currentToken()
  if (!ctx) throw new ApiError(422, 'NOT_CONFIGURED', 'Connect a Cloudflare account first.')
  const zones = await cfFetch<Array<{ id: string; name: string; status: string }>>('/zones?per_page=50', ctx.token)

  for (const zone of zones) {
    await db.cloudflareZone.upsert({
      where: { zoneId: zone.id },
      create: { zoneId: zone.id, name: zone.name, status: zone.status, accountId: ctx.accountId },
      update: { name: zone.name, status: zone.status, fetchedAt: new Date() },
    })
  }
  return zones.map((z) => ({ zoneId: z.id, name: z.name, status: z.status, fetchedAt: null }))
}

export interface CfDnsRecord {
  id: string
  type: string
  name: string
  content: string
  proxied: boolean | null
  ttl: number
}

export async function listDnsRecords(zoneId: string): Promise<CfDnsRecord[]> {
  const ctx = await currentToken()
  if (!ctx) throw new ApiError(422, 'NOT_CONFIGURED', 'Connect a Cloudflare account first.')
  const records = await cfFetch<Array<CfDnsRecord>>(`/zones/${encodeURIComponent(zoneId)}/dns_records?per_page=100`, ctx.token)
  await db.cloudflareZone.updateMany({ where: { zoneId }, data: { fetchedAt: new Date(), records: records as never } })
  return records.map((r) => ({ id: r.id, type: r.type, name: r.name, content: r.content, proxied: r.proxied ?? null, ttl: r.ttl }))
}
