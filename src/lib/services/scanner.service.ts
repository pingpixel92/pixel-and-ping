import dns from 'dns/promises'
import { tcpPing } from './health.service'
import { trackEvent } from '@/lib/audit'
import { logger } from '@/lib/logger'

/**
 * Controlled network diagnostic.
 * Performs real checks against a single user-supplied host:
 *   1. DNS resolution (A/AAAA)
 *   2. TCP connectivity + latency (optional port)
 *   3. HTTP(S) reachability (optional, no redirect following)
 * Rate limiting and authorization are enforced at the route level.
 */

export interface ScanInput {
  host: string
  port?: number
  http?: boolean
}

export interface ScanResult {
  host: string
  dns: {
    resolved: boolean
    addresses: string[]
    error?: string
  }
  tcp: {
    checked: boolean
    ok: boolean
    latencyMs: number | null
    error?: string
  }
  http: {
    checked: boolean
    ok: boolean
    statusCode: number | null
    latencyMs: number | null
    error?: string
  } | null
}

export async function scanTarget(input: ScanInput): Promise<ScanResult> {
  const { host, port, http } = input

  // ── DNS ──
  const dnsResult: ScanResult['dns'] = { resolved: false, addresses: [] }
  try {
    const lookup = await dns.lookup(host, { all: true })
    dnsResult.addresses = lookup.map((a) => a.address)
    dnsResult.resolved = dnsResult.addresses.length > 0
  } catch (err) {
    dnsResult.error = err instanceof Error ? err.message : 'DNS resolution failed'
  }

  // ── TCP ──
  const tcpResult: ScanResult['tcp'] = { checked: false, ok: false, latencyMs: null }
  if (port) {
    tcpResult.checked = true
    const probe = await tcpPing(host, port, 5000)
    tcpResult.ok = probe.ok
    tcpResult.latencyMs = probe.latencyMs
    tcpResult.error = probe.error
  }

  // ── HTTP ──
  let httpResult: ScanResult['http'] = null
  if (http) {
    httpResult = { checked: true, ok: false, statusCode: null, latencyMs: null }
    const url = `http${port === 443 ? 's' : ''}://${host}${port ? `:${port}` : ''}/`
    const started = performance.now()
    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
        headers: { 'user-agent': 'PixelAndPing-Scanner/1.0' },
      })
      httpResult.statusCode = res.status
      httpResult.ok = res.status < 500
      httpResult.latencyMs = Math.round(performance.now() - started)
    } catch (err) {
      httpResult.error = err instanceof Error ? err.message : 'HTTP request failed'
    }
  }

  const overall = dnsResult.resolved || tcpResult.ok
  await trackEvent({
    type: 'SCAN',
    level: overall ? 'INFO' : 'WARN',
    source: 'scanner',
    message: `Scanned ${host}${port ? `:${port}` : ''} — DNS ${dnsResult.resolved ? 'resolved' : 'failed'}${tcpResult.checked ? `, TCP ${tcpResult.ok ? 'open' : 'closed'}` : ''}`,
    meta: { host, port: port ?? null, resolved: dnsResult.resolved, tcpOk: tcpResult.ok },
  })
  logger.info('Scanner run', { host, port: port ?? null })

  return { host, dns: dnsResult, tcp: tcpResult, http: httpResult }
}
