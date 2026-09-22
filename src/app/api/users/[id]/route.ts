import { z } from 'zod'
import { db } from '@/lib/db'
import { ok, parseBody, withAuth, ApiError } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { getIp } from '@/lib/rate-limit'
import { auditVpnUser, effectiveStatus, generateConfigFor } from '@/lib/services/users.service'
import { logEvent } from '@/lib/audit'

const PROTOCOLS = ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS', 'HTTPS', 'HTTP', 'TCP'] as const

async function loadOrThrow(id: string) {
  const user = await db.vpnUser.findUnique({
    where: { id },
    include: {
      server: { select: { id: true, name: true } },
      endpoint: { select: { id: true, name: true } },
      port: { select: { id: true, number: true } },
      createdBy: { select: { username: true } },
    },
  })
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found.')
  return user
}

// ───────────────────────── GET /api/users/:id ─────────────────────────

export const GET = withAuth<{ id: string }>(async (req, ctx) => {
  const user = await loadOrThrow(ctx.params.id)

  const [configs, activity, logs] = await Promise.all([
    db.config.findMany({
      where: { vpnUserId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, name: true, protocol: true, createdAt: true },
    }),
    db.auditLog.findMany({
      where: { resourceType: 'VPN_USER', resourceId: user.id },
      orderBy: { at: 'desc' },
      take: 10,
    }),
    db.logEntry.findMany({
      where: { resourceType: 'VPN_USER', resourceId: user.id },
      orderBy: { at: 'desc' },
      take: 10,
    }),
  ])

  const settingsSoonDays = 7
  return ok({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      status: user.status,
      effectiveStatus: effectiveStatus(user, settingsSoonDays),
      protocol: user.protocol,
      hasConfig: Boolean(user.config),
      configUpdatedAt: user.configUpdatedAt?.toISOString() ?? null,
      server: user.server,
      endpoint: user.endpoint,
      port: user.port,
      expiresAt: user.expiresAt?.toISOString() ?? null,
      trafficLimitBytes: user.trafficLimitBytes !== null ? user.trafficLimitBytes.toString() : null,
      usedBytes: user.usedBytes.toString(),
      notes: user.notes,
      createdAt: user.createdAt.toISOString(),
      createdBy: user.createdBy?.username ?? null,
    },
    configs: configs.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
    activity: activity.map((a) => ({ id: a.id, at: a.at.toISOString(), action: a.action, actorLabel: a.actorLabel })),
    logs: logs.map((l) => ({ id: l.id, at: l.at.toISOString(), level: l.level, action: l.action, message: l.message })),
  })
}, { roles: rolesFor('users:read') })

// ───────────────────────── PATCH /api/users/:id ─────────────────────────

const patchSchema = z.object({
  displayName: z.string().max(100).optional().or(z.literal('')),
  email: z.string().email().max(255).optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
  protocol: z.enum(PROTOCOLS).optional(),
  serverId: z.string().nullable().optional(),
  endpointId: z.string().nullable().optional(),
  portId: z.string().nullable().optional(),
  unlimitedExpiry: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  unlimitedTraffic: z.boolean().optional(),
  trafficLimitGb: z.number().positive().max(1_000_000).nullable().optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  regenerate: z.boolean().optional(),
})

export const PATCH = withAuth<{ id: string }>(async (req, ctx) => {
  const body = await parseBody(req, patchSchema)
  const user = await loadOrThrow(ctx.params.id)
  const ip = getIp(req)

  const expiresProvided = body.expiresAt !== undefined || body.unlimitedExpiry !== undefined
  const expiresAt = body.unlimitedExpiry
    ? null
    : body.expiresAt !== undefined
      ? body.expiresAt
        ? new Date(body.expiresAt)
        : null
      : undefined

  const trafficLimitBytes =
    body.unlimitedTraffic === true
      ? null
      : body.trafficLimitGb !== undefined
        ? body.trafficLimitGb !== null
          ? BigInt(Math.round(body.trafficLimitGb * 1024 ** 3))
          : null
        : undefined

  const updated = await db.vpnUser.update({
    where: { id: user.id },
    data: {
      ...(body.displayName !== undefined ? { displayName: body.displayName || null } : {}),
      ...(body.email !== undefined ? { email: body.email ? body.email.toLowerCase() : null } : {}),
      ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
      ...(body.protocol ? { protocol: body.protocol } : {}),
      ...(body.serverId !== undefined ? { serverId: body.serverId || null } : {}),
      ...(body.endpointId !== undefined ? { endpointId: body.endpointId || null } : {}),
      ...(body.portId !== undefined ? { portId: body.portId || null } : {}),
      ...(expiresProvided ? { expiresAt: expiresAt ?? null } : {}),
      ...(trafficLimitBytes !== undefined ? { trafficLimitBytes } : {}),
      ...(body.status ? { status: body.status } : {}),
    },
  })

  // Regenerate config when requested or when protocol/infra changed.
  const infraChanged =
    body.protocol !== undefined || body.serverId !== undefined || body.endpointId !== undefined || body.portId !== undefined
  if (body.regenerate || (infraChanged && updated.config)) {
    try {
      await generateConfigFor(user.id, { regenerate: true })
    } catch {
      // Leave the previous config in place; surface via hasConfig/configUpdatedAt.
    }
  }

  if (body.status) {
    await auditVpnUser(
      body.status === 'DISABLED' ? 'VPN_USER_DISABLE' : 'VPN_USER_ENABLE',
      { id: ctx.auth.id, label: ctx.auth.username },
      user.id,
      user.username,
      ip,
    )
  }
  await auditVpnUser('VPN_USER_UPDATE', { id: ctx.auth.id, label: ctx.auth.username }, user.id, user.username, ip)

  return ok({ updated: true })
}, { roles: rolesFor('users:write') })

// ───────────────────────── DELETE /api/users/:id ─────────────────────────

export const DELETE = withAuth<{ id: string }>(async (req, ctx) => {
  const user = await loadOrThrow(ctx.params.id)
  const ip = getIp(req)

  await db.vpnUser.delete({ where: { id: user.id } })
  await auditVpnUser('VPN_USER_DELETE', { id: ctx.auth.id, label: ctx.auth.username }, user.id, user.username, ip)
  await logEvent({
    level: 'WARN',
    action: 'VPN_USER_DELETE',
    actor: ctx.auth.username,
    userId: ctx.auth.id,
    resourceType: 'VPN_USER',
    resourceId: user.id,
    message: `Deleted user "${user.username}"`,
    ip,
  })
  return ok({ deleted: true })
}, { roles: rolesFor('users:write') })


