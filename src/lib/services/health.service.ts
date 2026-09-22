import net from 'net'
import tls from 'tls'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { trackEvent } from '@/lib/audit'
import { pushNotification } from './notifications.service'

export interface ProbeResult {
  ok: boolean
  latencyMs: number | null
  error?: string
}

/** Real TCP connectivity probe with latency measurement. */
export function tcpPing(host: string, port: number, timeoutMs = 4000): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const started = process.hrtime.bigint()
    const socket = net.createConnection({ host, port })
    let settled = false
    const done = (result: ProbeResult) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(result)
    }
    socket.setTimeout(timeoutMs)
    socket.on('connect', () => {
      const latencyMs = Number(process.hrtime.bigint() - started) / 1e6
      done({ ok: true, latencyMs: Math.round(latencyMs) })
    })
    socket.on('timeout', () => done({ ok: false, latencyMs: null, error: `Timeout after ${timeoutMs}ms` }))
    socket.on('error', (err) => done({ ok: false, latencyMs: null, error: err.message }))
  })
}

/** Real TLS handshake probe (connection success + latency even with self-signed certs). */
export function tlsProbe(host: string, port: number, servername?: string, timeoutMs = 4000): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const started = process.hrtime.bigint()
    const socket = tls.connect({ host, port, servername: servername ?? host, rejectUnauthorized: false })
    let settled = false
    const done = (result: ProbeResult) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(result)
    }
    socket.setTimeout(timeoutMs)
    socket.on('secureConnect', () => {
      const latencyMs = Number(process.hrtime.bigint() - started) / 1e6
      done({ ok: true, latencyMs: Math.round(latencyMs) })
    })
    socket.on('timeout', () => done({ ok: false, latencyMs: null, error: `Timeout after ${timeoutMs}ms` }))
    socket.on('error', (err) => done({ ok: false, latencyMs: null, error: err.message }))
  })
}

/** Probe that respects TLS flag: performs a real TLS handshake when tls=true. */
export function probeTarget(host: string, port: number, useTls: boolean, sni?: string): Promise<ProbeResult> {
  return useTls ? tlsProbe(host, port, sni) : tcpPing(host, port)
}

async function recordStatusChange(
  target: 'SERVER' | 'ENDPOINT' | 'PORT',
  id: string,
  name: string,
  previous: string,
  next: 'ONLINE' | 'OFFLINE',
) {
  if (previous === next) return
  await trackEvent({
    type: 'HEALTH_CHECK',
    level: next === 'ONLINE' ? 'INFO' : 'WARN',
    source: 'jobs',
    message: `${target} "${name}" is now ${next}`,
    meta: { target, id, previous, next },
  })
  await pushNotification({
    type: 'HEALTH',
    title: `${target.charAt(0) + target.slice(1).toLowerCase()} ${next === 'ONLINE' ? 'back online' : 'went offline'}`,
    message: `"${name}" changed status from ${previous} to ${next}.`,
    dedupeKey: `health:${target}:${id}:${Date.now()}`,
    resourceType: target,
    resourceId: id,
  })
}

export async function checkServerById(id: string): Promise<ProbeResult> {
  const server = await db.server.findUnique({
    where: { id },
    include: { endpoints: { where: { enabled: true }, take: 1 } },
  })
  if (!server) return { ok: false, latencyMs: null, error: 'Server not found' }
  const port = server.endpoints[0]?.port ?? 443
  const host = server.ip || server.host
  const result = await tcpPing(host, port)

  await db.server.update({
    where: { id },
    data: {
      status: result.ok ? 'ONLINE' : 'OFFLINE',
      latencyMs: result.latencyMs,
      lastCheckAt: new Date(),
      lastError: result.ok ? null : (result.error ?? 'Connection failed'),
    },
  })
  await db.healthCheck.create({
    data: { target: 'SERVER', targetId: id, ok: result.ok, latencyMs: result.latencyMs, error: result.error ?? null },
  })
  await recordStatusChange('SERVER', id, server.name, server.status, result.ok ? 'ONLINE' : 'OFFLINE')
  return result
}

export async function checkEndpointById(id: string): Promise<ProbeResult> {
  const endpoint = await db.endpoint.findUnique({ where: { id } })
  if (!endpoint) return { ok: false, latencyMs: null, error: 'Endpoint not found' }
  const result = await probeTarget(endpoint.address, endpoint.port, endpoint.tls, endpoint.sni ?? undefined)

  await db.endpoint.update({
    where: { id },
    data: {
      status: result.ok ? 'ONLINE' : 'OFFLINE',
      latencyMs: result.latencyMs,
      lastCheckAt: new Date(),
      lastError: result.ok ? null : (result.error ?? 'Connection failed'),
    },
  })
  await db.healthCheck.create({
    data: { target: 'ENDPOINT', targetId: id, ok: result.ok, latencyMs: result.latencyMs, error: result.error ?? null },
  })
  await recordStatusChange('ENDPOINT', id, endpoint.name, endpoint.status, result.ok ? 'ONLINE' : 'OFFLINE')
  return result
}

export async function checkPortById(id: string): Promise<ProbeResult> {
  const port = await db.port.findUnique({ where: { id }, include: { server: true } })
  if (!port) return { ok: false, latencyMs: null, error: 'Port not found' }
  if (!port.server) {
    await db.port.update({
      where: { id },
      data: { status: 'UNKNOWN', lastCheckAt: new Date(), lastError: 'No server assigned' },
    })
    return { ok: false, latencyMs: null, error: 'No server assigned' }
  }
  const host = port.server.ip || port.server.host
  const result = await probeTarget(host, port.number, port.tls)

  await db.port.update({
    where: { id },
    data: {
      status: result.ok ? 'ONLINE' : 'OFFLINE',
      latencyMs: result.latencyMs,
      lastCheckAt: new Date(),
      lastError: result.ok ? null : (result.error ?? 'Connection failed'),
    },
  })
  await db.healthCheck.create({
    data: { target: 'PORT', targetId: id, ok: result.ok, latencyMs: result.latencyMs, error: result.error ?? null },
  })
  return result
}

export interface HealthRunSummary {
  servers: { total: number; online: number }
  endpoints: { total: number; online: number }
}

/** Runs health checks for every server and endpoint. Used by jobs and refresh actions. */
export async function runAllHealthChecks(): Promise<HealthRunSummary> {
  const [servers, endpoints] = await Promise.all([db.server.findMany(), db.endpoint.findMany()])

  const serverResults = await Promise.allSettled(servers.map((s) => checkServerById(s.id)))
  const endpointResults = await Promise.allSettled(endpoints.map((e) => checkEndpointById(e.id)))

  const serversOnline = serverResults.filter((r) => r.status === 'fulfilled' && r.value.ok).length
  const endpointsOnline = endpointResults.filter((r) => r.status === 'fulfilled' && r.value.ok).length

  const summary: HealthRunSummary = {
    servers: { total: servers.length, online: serversOnline },
    endpoints: { total: endpoints.length, online: endpointsOnline },
  }
  logger.info('Health check run completed', { ...summary })
  return summary
}

export async function checkDatabase(): Promise<ProbeResult> {
  const started = process.hrtime.bigint()
  try {
    await db.$queryRaw`SELECT 1`
    const latencyMs = Math.round(Number(process.hrtime.bigint() - started) / 1e6)
    return { ok: true, latencyMs }
  } catch (err) {
    return { ok: false, latencyMs: null, error: err instanceof Error ? err.message : 'Database unreachable' }
  }
}
