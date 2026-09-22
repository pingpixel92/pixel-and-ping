'use client'

import { Activity, Cpu, Database, Server } from 'lucide-react'
import { formatBytes, formatNumber, timeAgo } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { useApi } from '@/lib/hooks'
import { Reveal } from '@/components/reveal'
import { LinkButton, LoadingBlock, PageHeader, StatusBadge, Card, type SemanticState } from '@/components/ui-primitives'

interface SystemHealth {
  generatedAt: string
  database: { ok: boolean; latencyMs: number | null; error?: string }
  api: { state: string; uptimeSec: number }
  backgroundJobs: { state: string; lastRun: string | null; expiryScan: string | null; sessionCleanup: string | null; failoverCheck: string | null; intervalMin: number }
  runtime: { node: string; rssBytes: string; env: string }
  counts: Record<string, number>
}

export default function SystemPage() {
  const { t } = useI18n()
  const { data, loading, error } = useApi<SystemHealth>('/api/system/health', { refreshMs: 30_000 })

  if (loading && !data) return <LoadingBlock />
  if (error) return <Card className="p-10 text-center text-sm text-danger">{error.message}</Card>
  if (!data) return null

  const jobs = data.backgroundJobs

  return (
    <div>
      <PageHeader
        title={t('system.title')}
        subtitle="Live infrastructure self-report — database, API, background jobs and record counts."
        actions={<LinkButton href="/logs" variant="secondary" size="sm">{t('nav.logs')}</LinkButton>}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Reveal>
          <Card className="p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
              <Database size={15} className="text-brand" /> Core services
            </h2>
            <ul className="space-y-3">
              <ServiceRow
                label="Database (PostgreSQL)"
                state={data.database.ok ? 'HEALTHY' : 'UNAVAILABLE'}
                hint={data.database.ok ? `${data.database.latencyMs} ms round trip` : (data.database.error ?? 'unreachable')}
              />
              <ServiceRow label="API" state="HEALTHY" hint={`up ${Math.floor(data.api.uptimeSec / 60)} min`} />
              <ServiceRow
                label="Background jobs"
                state={jobs.state as 'HEALTHY' | 'DEGRADED' | 'NOT_CONFIGURED'}
                hint={`health every ${jobs.intervalMin} min · last run ${timeAgo(jobs.lastRun)}`}
              />
            </ul>
          </Card>
        </Reveal>

        <Reveal delay={0.06}>
          <Card className="p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
              <Cpu size={15} className="text-brand" /> Runtime
            </h2>
            <dl className="space-y-3 text-sm">
              <Row label="Node.js" value={data.runtime.node} />
              <Row label="Environment" value={data.runtime.env} />
              <Row label="Memory (RSS)" value={formatBytes(data.runtime.rssBytes)} />
              <Row label="Reported" value={`${formatDateTimeSafe(data.generatedAt)} · ${timeAgo(data.generatedAt)}`} />
            </dl>
          </Card>
        </Reveal>

        <Reveal delay={0.1} className="lg:col-span-2">
          <Card className="p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
              <Server size={15} className="text-brand" /> Records
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {Object.entries(data.counts).map(([key, value]) => (
                <div key={key} className="rounded-xl bg-surface p-3.5">
                  <p className="num text-lg font-semibold text-ink">{formatNumber(value)}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wider text-ink-soft">
                    {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>
      </div>
    </div>
  )
}

function ServiceRow({ label, state, hint }: { label: string; state: SemanticState; hint: string }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl bg-surface/60 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-[11px] text-ink-soft">{hint}</p>
      </div>
      <StatusBadge state={state} />
    </li>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="mono text-xs font-medium text-ink">{value}</dd>
    </div>
  )
}

function formatDateTimeSafe(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
