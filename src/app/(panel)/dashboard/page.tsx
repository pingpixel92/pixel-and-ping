'use client'

import { Activity, Server, Users, Waypoints } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { formatBytes, formatNumber, greetingKey, timeAgo } from '@/lib/format'
import { useApi } from '@/lib/hooks'
import { AreaChart } from '@/components/charts'
import { Reveal, AnimatedValue, Stagger, StaggerItem } from '@/components/reveal'
import { Button, Card, LinkButton, PageHeader, Skeleton, StatusBadge } from '@/components/ui-primitives'
import { useMe } from '@/components/shell/auth-gate'

interface DashboardData {
  generatedAt: string
  users: { total: number; active: number; expiringSoon: number; expired: number; disabled: number }
  servers: { total: number; online: number; offline: number; unknown: number }
  endpoints: { total: number; online: number; enabled: number }
  traffic24h: { bytesIn: string; bytesOut: string; requests: number }
  events24h: number
  panelAccounts: number
  activeSessions: number
  health: {
    database: { state: string; latencyMs: number | null }
    api: { state: string }
    backgroundJobs: { state: string; lastRun: string | null }
  }
  recentLogs: Array<{ id: string; at: string; level: string; action: string; message: string }>
}

interface TrafficMini {
  series: Array<{ t: string; bytesIn: number; bytesOut: number; requests: number }>
  totals: { bytesIn: string; bytesOut: string; requests: number }
}

export default function DashboardPage() {
  const { t } = useI18n()
  const { user } = useMe()
  const [autoRefresh, setAutoRefresh] = useState(false)
  const dashboard = useApi<DashboardData>('/api/dashboard', { refreshMs: autoRefresh ? 30_000 : undefined })
  const traffic = useApi<TrafficMini>('/api/traffic?range=24h', { refreshMs: autoRefresh ? 60_000 : undefined })

  const data = dashboard.data

  useEffect(() => {
    const stored = window.localStorage.getItem('pp_autoRefresh')
    if (stored === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-mount sync (hydration-safe)
      setAutoRefresh(true)
    }
  }, [])

  function toggleAuto() {
    const next = !autoRefresh
    setAutoRefresh(next)
    window.localStorage.setItem('pp_autoRefresh', next ? '1' : '0')
  }

  const overallState =
    data?.health.database.state === 'HEALTHY' && data?.health.backgroundJobs.state !== 'DEGRADED' ? 'HEALTHY' : data ? 'DEGRADED' : 'UNKNOWN'

  return (
    <div>
      <PageHeader
        title={`${t(greetingKey())}${user ? `, ${user.displayName.split(' ')[0]}` : ''}`}
        subtitle={
          data ? (
            <span className="inline-flex items-center gap-2">
              {t('dashboard.systemStatus')}:
              <StatusBadge
                state={overallState as 'HEALTHY' | 'DEGRADED'}
                label={overallState === 'HEALTHY' ? t('dashboard.operational') : t('status.DEGRADED')}
              />
              <span className="text-xs">· updated {timeAgo(data.generatedAt)}</span>
            </span>
          ) : (
            t('common.loading')
          )
        }
        actions={
          <>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={toggleAuto}
                className="h-3.5 w-3.5 accent-[var(--brand)]"
              />
              {t('common.autoRefresh')}
            </label>
            <Button variant="secondary" size="sm" onClick={() => void dashboard.reload()} loading={dashboard.loading && !!data}>
              {t('common.refresh')}
            </Button>
          </>
        }
      />

      {/* Stat cards */}
      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem>
          <StatCardShell
            label={t('dashboard.activeUsers')}
            value={data ? <AnimatedValue>{formatNumber(data.users.active)}</AnimatedValue> : <Skeleton className="h-7 w-16" />}
            hint={data ? `${data.users.expiringSoon} expiring soon · ${data.users.expired} expired` : undefined}
            icon={<Users size={17} />}
            href="/users"
          />
        </StaggerItem>
        <StaggerItem>
          <StatCardShell
            label={t('dashboard.onlineEndpoints')}
            value={data ? <AnimatedValue>{formatNumber(data.endpoints.online)}</AnimatedValue> : <Skeleton className="h-7 w-16" />}
            hint={data ? `${data.endpoints.enabled} of ${data.endpoints.total} enabled` : undefined}
            icon={<Waypoints size={17} />}
            href="/endpoints"
          />
        </StaggerItem>
        <StaggerItem>
          <StatCardShell
            label={t('dashboard.servers')}
            value={data ? <AnimatedValue>{formatNumber(data.servers.total)}</AnimatedValue> : <Skeleton className="h-7 w-16" />}
            hint={data ? `${data.servers.online} online · ${data.servers.offline} offline · ${data.servers.unknown} unknown` : undefined}
            icon={<Server size={17} />}
            href="/servers"
          />
        </StaggerItem>
        <StaggerItem>
          <div className="relative overflow-hidden rounded-2xl bg-navy-900 p-5 text-white shadow-[var(--shadow-card)]">
            <div className="pixel-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-white/55">{t('dashboard.traffic')}</p>
                <p className="num mt-2 text-[28px] font-semibold leading-none">
                  {traffic.data ? (
                    <AnimatedValue>{formatBytes(Number(traffic.data.totals.bytesIn) + Number(traffic.data.totals.bytesOut))}</AnimatedValue>
                  ) : (
                    <Skeleton className="h-7 w-16 bg-white/10" />
                  )}
                </p>
                <p className="mt-2 text-xs text-white/60">
                  {t('dashboard.requests')}: {data ? formatNumber(data.events24h) : '—'}
                </p>
              </div>
              <div className="rounded-xl bg-white/10 p-2.5 text-brand-light">
                <Activity size={17} />
              </div>
            </div>
          </div>
        </StaggerItem>
      </Stagger>

      {/* Charts + health */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Traffic — 24h</h2>
              <LinkButton href="/traffic" variant="ghost" size="sm">
                {t('traffic.title')} →
              </LinkButton>
            </div>
            {traffic.data && traffic.data.series.length > 0 ? (
              <AreaChart
                series={traffic.data.series.map((p) => ({ t: p.t, a: p.bytesIn, b: p.bytesOut }))}
                labelA="In"
                labelB="Out"
                formatValue={(v) => formatBytes(v)}
              />
            ) : (
              <div className="flex h-44 flex-col items-center justify-center gap-2 rounded-xl bg-surface text-sm text-ink-soft">
                <p>No traffic data yet.</p>
                <p className="text-xs">Traffic records appear once ingested via the ingest API.</p>
              </div>
            )}
          </Card>
        </Reveal>

        <Reveal delay={0.08}>
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">{t('dashboard.systemHealth')}</h2>
            {data ? (
              <ul className="space-y-3">
                <HealthRow label={t('dashboard.database')} state={data.health.database.state} hint={data.health.database.latencyMs !== null ? `${data.health.database.latencyMs} ms` : undefined} />
                <HealthRow label={t('dashboard.api')} state="HEALTHY" hint="responding" />
                <HealthRow
                  label={t('dashboard.backgroundJobs')}
                  state={data.health.backgroundJobs.state}
                  hint={data.health.backgroundJobs.lastRun ? `last run ${timeAgo(data.health.backgroundJobs.lastRun)}` : 'no runs yet'}
                />
              </ul>
            ) : (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            )}
          </Card>
        </Reveal>
      </div>

      {/* Recent activity */}
      <Reveal className="mt-6" y={10}>
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">{t('dashboard.recentActivity')}</h2>
            <LinkButton href="/logs" variant="ghost" size="sm">
              {t('logs.title')} →
            </LinkButton>
          </div>
          {data && data.recentLogs.length > 0 ? (
            <ul className="divide-y divide-hairline">
              {data.recentLogs.map((log) => (
                <li key={log.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{log.message}</p>
                    <p className="text-[11px] text-ink-soft">
                      {log.action} · {timeAgo(log.at)}
                    </p>
                  </div>
                  <StatusBadge
                    state={log.level === 'ERROR' ? 'FAILED' : log.level === 'WARN' ? 'DEGRADED' : 'ONLINE'}
                    label={log.level}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-ink-soft">{t('dashboard.noActivity')}</p>
          )}
        </Card>
      </Reveal>
    </div>
  )
}

function StatCardShell({
  label,
  value,
  hint,
  icon,
  href,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  icon: React.ReactNode
  href: string
}) {
  return (
    <Link href={href} className="card block p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-soft">{label}</p>
          <p className="num mt-2 text-[28px] font-semibold leading-none text-ink">{value}</p>
          {hint && <p className="mt-2 text-xs text-ink-soft">{hint}</p>}
        </div>
        <div className="rounded-xl bg-surface p-2.5 text-brand">{icon}</div>
      </div>
    </Link>
  )
}

function HealthRow({ label, state, hint }: { label: string; state: string; hint?: string }) {
  const map: Record<string, 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'NOT_CONFIGURED'> =
    state === 'HEALTHY' ? 'HEALTHY' : state === 'DEGRADED' ? 'DEGRADED' : state === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'NOT_CONFIGURED'
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl bg-surface/60 px-3 py-2">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint && <p className="text-[11px] text-ink-soft">{hint}</p>}
      </div>
      <StatusBadge state={map} />
    </li>
  )
}
