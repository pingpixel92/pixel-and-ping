import { db } from '@/lib/db'
import type { VpnUser, Endpoint, Port, Server } from '@prisma/client'
import { getProvider, ProviderNotConfiguredError } from './providers'
import { ApiError } from '@/lib/api'
import { audit, trackEvent } from '@/lib/audit'

// ───────────────────────── Status helpers (server-side truth) ─────────────────────────

export type ExpiryBucket = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'UNLIMITED'

export function expiryBucket(user: Pick<VpnUser, 'expiresAt' | 'status'>, soonDays = 7): ExpiryBucket {
  if (!user.expiresAt) return 'UNLIMITED'
  if (user.expiresAt.getTime() < Date.now()) return 'EXPIRED'
  if (user.expiresAt.getTime() < Date.now() + soonDays * 86_400_000) return 'EXPIRING_SOON'
  return 'ACTIVE'
}

export function effectiveStatus(user: Pick<VpnUser, 'expiresAt' | 'status'>, soonDays = 7) {
  if (user.status === 'DISABLED') return 'DISABLED' as const
  return expiryBucket(user, soonDays)
}

// ───────────────────────── Config generation ─────────────────────────

interface InfraContext {
  host: string
  port: number
  tls: boolean
  sni: string | null
}

function resolveInfra(
  server: Pick<Server, 'host' | 'ip'> | null,
  endpoint: Pick<Endpoint, 'address' | 'port' | 'tls' | 'sni'> | null,
  port: Pick<Port, 'number' | 'tls'> | null,
): InfraContext | null {
  if (endpoint) {
    return { host: endpoint.address, port: endpoint.port, tls: endpoint.tls, sni: endpoint.sni }
  }
  if (port && server) {
    return { host: server.ip || server.host, port: port.number, tls: port.tls, sni: null }
  }
  if (server) {
    return { host: server.ip || server.host, port: 443, tls: true, sni: null }
  }
  return null
}

export async function generateConfigFor(vpnUserId: string, opts: { regenerate?: boolean } = {}): Promise<string> {
  const user = await db.vpnUser.findUnique({
    where: { id: vpnUserId },
    include: { server: true, endpoint: true, port: { include: { server: true } } },
  })
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found.')

  const infra = resolveInfra(user.server, user.endpoint, user.port)
  if (!infra) {
    throw new ApiError(422, 'NO_INFRASTRUCTURE', 'Assign a server or an endpoint to this user before generating a configuration.')
  }

  const provider = getProvider(user.protocol)
  try {
    const credentials =
      opts.regenerate || !user.credentials
        ? provider.createCredentials()
        : (user.credentials as ReturnType<ReturnType<typeof getProvider>['createCredentials']>)

    const content = provider.buildConfig({
      username: user.username,
      displayName: user.displayName,
      host: infra.host,
      port: infra.port,
      tls: infra.tls,
      sni: infra.sni,
      credentials,
    })

    await db.vpnUser.update({
      where: { id: user.id },
      data: { credentials: credentials as never, config: content, configUpdatedAt: new Date() },
    })
    await db.config.create({
      data: {
        name: `${user.username}-${user.protocol.toLowerCase()}-${new Date().toISOString().slice(0, 10)}`,
        protocol: user.protocol,
        content,
        vpnUserId: user.id,
      },
    })
    await trackEvent({
      type: 'CONFIG_GENERATED',
      source: 'api',
      message: `Generated ${user.protocol} config for "${user.username}"`,
      meta: { vpnUserId: user.id, protocol: user.protocol, regenerated: opts.regenerate ?? false },
    })
    return content
  } catch (err) {
    if (err instanceof ProviderNotConfiguredError) {
      throw new ApiError(422, 'PROVIDER_NOT_CONFIGURED', err.message)
    }
    throw err
  }
}

// ───────────────────────── Expiry scanning (used by background jobs) ─────────────────────────

export async function scanExpiry(expiryAlertDays: number, notifyEnabled: boolean): Promise<{ expired: number; alerted: number }> {
  const now = new Date()
  const soon = new Date(now.getTime() + expiryAlertDays * 86_400_000)

  // 1. Mark expired users.
  const expiredUpdate = await db.vpnUser.updateMany({
    where: { status: 'ACTIVE', expiresAt: { lt: now, not: null } },
    data: { status: 'EXPIRED' },
  })

  // 2. Expiry alerts for active users inside the alert window.
  let alerted = 0
  if (notifyEnabled) {
    const expiring = await db.vpnUser.findMany({
      where: { status: 'ACTIVE', expiresAt: { gte: now, lte: soon, not: null } },
      select: { id: true, username: true, expiresAt: true },
    })
    for (const user of expiring) {
      const dayKey = new Date().toISOString().slice(0, 10)
      const created = await db.notification.createMany({
        data: [{
          type: 'EXPIRY',
          title: 'User expiring soon',
          message: `"${user.username}" expires on ${user.expiresAt?.toISOString().slice(0, 10) ?? 'unknown'}.`,
          dedupeKey: `expiry:${user.id}:${dayKey}`,
          resourceType: 'VPN_USER',
          resourceId: user.id,
        }],
        skipDuplicates: true,
      })
      alerted += created.count
    }
  }

  return { expired: expiredUpdate.count, alerted }
}

// ───────────────────────── Audit helper for vpn user actions ─────────────────────────

export async function auditVpnUser(
  action: string,
  actor: { id: string; label: string },
  vpnUserId: string | null,
  username: string | null,
  ip: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await audit({
    actorId: actor.id,
    actorLabel: actor.label,
    action,
    resourceType: 'VPN_USER',
    resourceId: vpnUserId,
    ip,
    metadata: { username, ...metadata },
  })
}
