'use client'

import { useState } from 'react'
import { Radar } from 'lucide-react'
import { api, ApiClientError } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { Reveal } from '@/components/reveal'
import { useToast } from '@/components/toast'
import {
  Button, Card, Field, Input, MonoValue, PageHeader, StatusBadge, Toggle,
} from '@/components/ui-primitives'

interface ScanResult {
  host: string
  dns: { resolved: boolean; addresses: string[]; error?: string }
  tcp: { checked: boolean; ok: boolean; latencyMs: number | null; error?: string }
  http: { checked: boolean; ok: boolean; statusCode: number | null; latencyMs: number | null; error?: string } | null
}

export default function IpScannerPage() {
  const { t } = useI18n()
  const toast = useToast()
  const [host, setHost] = useState('')
  const [port, setPort] = useState('')
  const [http, setHttp] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)

  async function scan(e: React.FormEvent) {
    e.preventDefault()
    setScanning(true)
    setResult(null)
    try {
      const res = await api<ScanResult>('/api/scanner', {
        method: 'POST',
        body: { host: host.trim(), ...(port ? { port: Number(port) } : {}), http },
      })
      setResult(res)
    } catch (err) {
      toast.error('Scan failed', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setScanning(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={t('nav.scanner')}
        subtitle="Controlled diagnostics for hosts you are authorized to inspect — DNS, TCP and HTTP, real results only. Limited to 10 scans/minute."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Reveal>
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-ink">Target</h2>
            <form onSubmit={scan} className="space-y-4">
              <Field label="Hostname or IPv4" htmlFor="scan-host">
                <Input id="scan-host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="vpn.example.com" required minLength={3} maxLength={253} />
              </Field>
              <div className="grid grid-cols-2 items-end gap-4">
                <Field label="TCP port (optional)" htmlFor="scan-port">
                  <Input id="scan-port" type="number" min="1" max="65535" value={port} onChange={(e) => setPort(e.target.value)} placeholder="443" />
                </Field>
                <label className="flex items-center gap-2.5 pb-1 text-sm text-ink">
                  <Toggle checked={http} onChange={setHttp} label="HTTP check" />
                  HTTP check
                </label>
              </div>
              <Button type="submit" loading={scanning} className="w-full">
                <Radar size={15} /> Run scan
              </Button>
            </form>
          </Card>
        </Reveal>

        <Reveal delay={0.06}>
          <Card className="flex min-h-[280px] flex-col p-5">
            <h2 className="mb-4 text-sm font-semibold text-ink">Results</h2>
            {!result ? (
              <div className="flex flex-1 items-center justify-center rounded-xl bg-surface text-sm text-ink-soft">
                Scan results appear here.
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-ink-soft">
                  Target <MonoValue>{result.host}</MonoValue>
                </p>
                <ResultRow
                  label="DNS"
                  state={result.dns.resolved ? 'ONLINE' : 'FAILED'}
                  detail={result.dns.resolved ? result.dns.addresses.join(', ') : (result.dns.error ?? 'Not resolved')}
                />
                <ResultRow
                  label="TCP"
                  state={!result.tcp.checked ? 'NOT_CONFIGURED' : result.tcp.ok ? 'ONLINE' : 'FAILED'}
                  detail={
                    !result.tcp.checked
                      ? 'No port specified'
                      : result.tcp.ok
                        ? `Open — ${result.tcp.latencyMs} ms`
                        : (result.tcp.error ?? 'Closed / filtered')
                  }
                />
                <ResultRow
                  label="HTTP"
                  state={!result.http?.checked ? 'NOT_CONFIGURED' : result.http.ok ? 'ONLINE' : 'FAILED'}
                  detail={
                    !result.http?.checked
                      ? 'Disabled'
                      : result.http.statusCode !== null
                        ? `HTTP ${result.http.statusCode} — ${result.http.latencyMs} ms`
                        : (result.http.error ?? 'No response')
                  }
                />
              </div>
            )}
          </Card>
        </Reveal>
      </div>
    </div>
  )
}

function ResultRow({ label, state, detail }: { label: string; state: 'ONLINE' | 'FAILED' | 'NOT_CONFIGURED'; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-surface/70 px-3.5 py-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{label}</span>
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="mono truncate text-xs text-ink" title={detail}>
          {detail}
        </span>
        <StatusBadge state={state} />
      </div>
    </div>
  )
}
