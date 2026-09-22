import { Prisma, type LogLevel } from '@prisma/client'
import { db } from '@/lib/db'
import { getSettings, getJobState } from './settings.service'
import { checkDatabase } from './health.service'

// ───────────────────────── Ranges ─────────────────────────

export type TimeRange = '24h' | '7d' | '30d' | 'all'

export function rangeToSince(range: TimeRange): Date | null {
  const now = Date.now()
  switch (range) {
    case '24h': return new Date(now - 86_400_000)
    case '7d': return new Date(now - 7 * 86_400_000)
    case '30d': return new Date(now - 30 * 86_400_000)
    default: return null
  }
}

export function rangeToUnit(range: TimeRange): 'hour' | 'day' {
  return range === '24h' ? 'hour' : 'day'
}

export function parseRange(value: string | null): TimeRange {
  return value === '24h' || value === '7d' || value === '30d' || value === 'all' ? value : '7d'
}

// ───────────────────────── Dashboard ─────────────────────────

export interface DashboardHealth {
  database: { state: 'HEALTHY' | 'UNAVAILABLE'; latencyMs: number | null }
  api: { state: 'HEALTHY' }
  backgroundJobs: { state: 'HEALTHY' | 'DEGRADED' | 'NOT_CONFIGURED'; lastRun: string | null }
  cloudflare: { state: 'NOT_CONFIGURED' | 'HEALTHY' | 'DEGRADED' }
}

export interface DashboardData {
  generatedAt: string
  users: {
    total: number
    active: number
    expiringSoon: number
    expired: number
    disabled: number
  }
  servers: { total: number; online: number; offline: number; unknown: number }
  endpoints: { total: number; online: number; enabled: number }
  traffic24h: { bytesIn: string; bytesOut: string; requests: number }
  events24h: number
  panelAccounts: number
  activeSessions: number
  health: DashboardHealth
  recentLogs: Array<{ id: string; at: string; level: LogLevel; action: string; message: string }>
}

export async function getDashboard(): Promise<DashboardData> {
  const now = new Date()
  const since24h = new Date(now.getTime() - 86_400_000)
  const soon = new Date(now.getTime() + 7 * 86_400_000)

  const [
    vpnTotal,
    vpnActive,
    vpnDisabled,
    vpnExpired,
    vpnExpiring,
    serverGroup,
    endpointTotal,
    endpointEnabled,
    endpointOnline,
    trafficAgg,
    events24h,
    panelAccounts,
    activeSessions,
    cfAccount,
    settings,
    jobState,
    recentLogs,
    dbProbe,
  ] = await Promise.all([
    db.vpnUser.count(),
    db.vpnUser.count({ where: { status: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
    db.vpnUser.count({ where: { status: 'DISABLED' } }),
    db.vpnUser.count({ where: { status: 'EXPIRED' } }),
    db.vpnUser.count({ where: { status: 'ACTIVE', expiresAt: { gt: now, lte: soon } } }),
    db.server.groupBy({ by: ['status'], _count: true }),
    db.endpoint.count(),
    db.endpoint.count({ where: { enabled: true } }),
    db.endpoint.count({ where: { status: 'ONLINE' } }),
    db.trafficRecord.aggregate({
      where: { at: { gte: since24h } },
      _sum: { bytesIn: true, bytesOut: true, requests: true },
    }),
    db.analyticsEvent.count({ where: { at: { gte: since24h } } }),
    db.user.count(),
    db.session.count({ where: { expiresAt: { gt: now } } }),
    db.cloudflareAccount.findFirst({ select: { verified: true } }),
    getSettings(),
    getJobState(),
    db.logEntry.findMany({ orderBy: { at: 'desc' }, take: 6 }),
    checkDatabase(),
  ])

  const statusOf = (key: string) => serverGroup.find((g) => g.status === key)?._count ?? 0
  const lastHealthRun = jobState.healthCheck ? new Date(jobState.healthCheck) : null
  const healthAgeMs = lastHealthRun ? now.getTime() - lastHealthRun.getTime() : null
  const jobsState: DashboardHealth['backgroundJobs']['state'] =
    !lastHealthRun
      ? 'NOT_CONFIGURED'
      : healthAgeMs !== null && healthAgeMs <= settings.healthCheckIntervalMin * 60_000 * 2
        ? 'HEALTHY'
        : 'DEGRADED'

  return {
    generatedAt: now.toISOString(),
    users: { total: vpnTotal, active: vpnActive, expiringSoon: vpnExpiring, expired: vpnExpired, disabled: vpnDisabled },
    servers: {
      total: serverGroup.reduce((a, g) => a + g._count, 0),
      online: statusOf('ONLINE'),
      offline: statusOf('OFFLINE'),
      unknown: statusOf('UNKNOWN'),
    },
    endpoints: { total: endpointTotal, online: endpointOnline, enabled: endpointEnabled },
    traffic24h: {
      bytesIn: (trafficAgg._sum.bytesIn ?? BigInt(0)).toString(),
      bytesOut: (trafficAgg._sum.bytesOut ?? BigInt(0)).toString(),
      requests: trafficAgg._sum.requests ?? 0,
    },
    events24h,
    panelAccounts,
    activeSessions,
    health: {
      database: { state: dbProbe.ok ? 'HEALTHY' : 'UNAVAILABLE', latencyMs: dbProbe.latencyMs },
      api: { state: 'HEALTHY' },
      backgroundJobs: { state: jobsState, lastRun: lastHealthRun?.toISOString() ?? null },
      cloudflare: { state: cfAccount ? (cfAccount.verified ? 'HEALTHY' : 'DEGRADED') : 'NOT_CONFIGURED' },
    },
    recentLogs: recentLogs.map((l) => ({ id: l.id, at: l.at.toISOString(), level: l.level, action: l.action, message: l.message })),
  }
}

// ───────────────────────── System health (System page) ─────────────────────────

export async function getSystemHealth() {
  const now = new Date()
  const [dbProbe, settings, jobState, counts, cfAccount, nodeVersion, memUsage] = await Promise.all([
    checkDatabase(),
    getSettings(),
    getJobState(),
    Promise.all([
      db.vpnUser.count(), db.server.count(), db.endpoint.count(), db.port.count(),
      db.config.count(), db.logEntry.count(), db.auditLog.count(), db.analyticsEvent.count(),
      db.trafficRecord.count(), db.session.count({ where: { expiresAt: { gt: now } } }),
      db.notification.count(), db.apiKey.count(),
    ]),
    db.cloudflareAccount.findFirst({ select: { verified: true, lastVerifiedAt: true } }),
    Promise.resolve(process.version),
    Promise.resolve(process.memoryUsage().rss),
  ])

  const jobs = {
    healthCheck: jobState.healthCheck ?? null,
    expiryScan: jobState.expiryScan ?? null,
    sessionCleanup: jobState.sessionCleanup ?? null,
    failoverCheck: jobState.failoverCheck ?? null,
    intervalMin: settings.healthCheckIntervalMin,
  }

  const last = jobState.healthCheck ? new Date(jobState.healthCheck).getTime() : 0
  const jobsState = !last
    ? 'NOT_CONFIGURED'
    : now.getTime() - last <= settings.healthCheckIntervalMin * 60_000 * 2
      ? 'HEALTHY'
      : 'DEGRADED'

  return {
    generatedAt: now.toISOString(),
    database: dbProbe,
    api: { state: 'HEALTHY' as const, uptimeSec: Math.round(process.uptime()) },
    backgroundJobs: { ...jobs, state: jobsState },
    integrations: {
      cloudflare: cfAccount
        ? { state: 'HEALTHY' as const, lastVerifiedAt: cfAccount.lastVerifiedAt?.toISOString() ?? null }
        : { state: 'NOT_CONFIGURED' as const, lastVerifiedAt: null },
    },
    runtime: { node: nodeVersion, rssBytes: memUsage.toString(), env: process.env.NODE_ENV ?? 'development' },
    counts: {
      vpnUsers: counts[0], servers: counts[1], endpoints: counts[2], ports: counts[3],
      configs: counts[4], logs: counts[5], auditLogs: counts[6], analyticsEvents: counts[7],
      trafficRecords: counts[8], activeSessions: counts[9], notifications: counts[10], apiKeys: counts[11],
    },
  }
}

// ───────────────────────── Traffic ─────────────────────────

export interface TrafficData {
  range: TimeRange
  totals: { bytesIn: string; bytesOut: string; requests: number }
  series: Array<{ t: string; bytesIn: number; bytesOut: number; requests: number }>
  topUsers: Array<{ username: string; bytesIn: string; bytesOut: string }>
  recent: Array<{ id: string; at: string; username: string | null; bytesIn: string; bytesOut: string; requests: number; source: string }>
}

export async function getTraffic(range: TimeRange): Promise<TrafficData> {
  const since = rangeToSince(range)
  const where = since ? { at: { gte: since } } : {}

  const [totals, recentRaw] = await Promise.all([
    db.trafficRecord.aggregate({ where, _sum: { bytesIn: true, bytesOut: true, requests: true } }),
    db.trafficRecord.findMany({
      where,
      orderBy: { at: 'desc' },
      take: 100,
      include: { vpnUser: { select: { username: true } } },
    }),
  ])

  const unit = rangeToUnit(range)
  const sinceSql = since ?? new Date(0)
  const seriesRows = await db.$queryRaw<Array<{ bucket: Date; bytes_in: number; bytes_out: number; requests: number }>>(
    Prisma.sql`
      SELECT date_trunc(${unit}, "at") AS bucket,
             COALESCE(SUM("bytesIn"), 0)::double precision AS bytes_in,
             COALESCE(SUM("bytesOut"), 0)::double precision AS bytes_out,
             COALESCE(SUM("requests"), 0)::double precision AS requests
      FROM "TrafficRecord"
      WHERE "at" >= ${sinceSql}
      GROUP BY 1
      ORDER BY 1 ASC
      LIMIT 500
    `,
  )

  const topUserRows = await db.$queryRaw<Array<{ username: string; bytes_in: string; bytes_out: string }>>(
    Prisma.sql`
      SELECT COALESCE(vu."username", '—') AS username,
             SUM(t."bytesIn")::text AS bytes_in,
             SUM(t."bytesOut")::text AS bytes_out
      FROM "TrafficRecord" t
      LEFT JOIN "VpnUser" vu ON vu."id" = t."vpnUserId"
      WHERE t."at" >= ${sinceSql}
      GROUP BY 1
      ORDER BY SUM(t."bytesIn") + SUM(t."bytesOut") DESC
      LIMIT 10
    `,
  )

  return {
    range,
    totals: {
      bytesIn: (totals._sum.bytesIn ?? BigInt(0)).toString(),
      bytesOut: (totals._sum.bytesOut ?? BigInt(0)).toString(),
      requests: totals._sum.requests ?? 0,
    },
    series: seriesRows.map((r) => ({
      t: new Date(r.bucket).toISOString(),
      bytesIn: Number(r.bytes_in),
      bytesOut: Number(r.bytes_out),
      requests: Number(r.requests),
    })),
    topUsers: topUserRows.map((r) => ({ username: r.username, bytesIn: r.bytes_in, bytesOut: r.bytes_out })),
    recent: recentRaw.map((r) => ({
      id: r.id,
      at: r.at.toISOString(),
      username: r.vpnUser?.username ?? null,
      bytesIn: r.bytesIn.toString(),
      bytesOut: r.bytesOut.toString(),
      requests: r.requests,
      source: r.source,
    })),
  }
}

// ───────────────────────── Analytics ─────────────────────────

export interface AnalyticsData {
  range: TimeRange
  totals: { events: number; errors: number; logins: number; scans: number; configsGenerated: number }
  byType: Array<{ type: string; count: number }>
  series: Array<{ t: string; total: number; errors: number }>
  activeSessions: number
}

export async function getAnalytics(range: TimeRange): Promise<AnalyticsData> {
  const since = rangeToSince(range)
  const where = since ? { at: { gte: since } } : {}
  const now = new Date()

  const [events, errors, logins, scans, configsGenerated, byType, activeSessions] = await Promise.all([
    db.analyticsEvent.count({ where }),
    db.analyticsEvent.count({ where: { AND: [where, { level: 'ERROR' }] } }),
    db.analyticsEvent.count({ where: { AND: [where, { type: 'LOGIN' }] } }),
    db.analyticsEvent.count({ where: { AND: [where, { type: 'SCAN' }] } }),
    db.analyticsEvent.count({ where: { AND: [where, { type: 'CONFIG_GENERATED' }] } }),
    db.analyticsEvent.groupBy({ by: ['type'], _count: true, where }),
    db.session.count({ where: { expiresAt: { gt: now } } }),
  ])

  const unit = rangeToUnit(range)
  const sinceSql = since ?? new Date(0)
  const seriesRows = await db.$queryRaw<Array<{ bucket: Date; total: number; errors: number }>>(
    Prisma.sql`
      SELECT date_trunc(${unit}, "at") AS bucket,
             COUNT(*)::double precision AS total,
             COUNT(*) FILTER (WHERE "level" = 'ERROR')::double precision AS errors
      FROM "AnalyticsEvent"
      WHERE "at" >= ${sinceSql}
      GROUP BY 1
      ORDER BY 1 ASC
      LIMIT 500
    `,
  )

  return {
    range,
    totals: { events, errors, logins, scans, configsGenerated },
    byType: byType.map((g) => ({ type: g.type, count: g._count })).sort((a, b) => b.count - a.count),
    series: seriesRows.map((r) => ({
      t: new Date(r.bucket).toISOString(),
      total: Number(r.total),
      errors: Number(r.errors),
    })),
    activeSessions,
  }
}
