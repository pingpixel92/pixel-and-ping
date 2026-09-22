'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { formatBytes, formatDateTime, formatNumber } from '@/lib/format'
import { useApi } from '@/lib/hooks'
import { AreaChart, BarChart } from '@/components/charts'
import { Reveal } from '@/components/reveal'
import { Card, EmptyState, LoadingBlock, PageHeader, Tabs, MonoValue } from '@/components/ui-primitives'
import { LinkButton } from '@/components/ui-primitives'

interface TrafficData {
  range: string
  totals: { bytesIn: string; bytesOut: string; requests: number }
  series: Array<{ t: string; bytesIn: number; bytesOut: number; requests: number }>
  topUsers: Array<{ username: string; bytesIn: string; bytesOut: string }>
  recent: Array<{ id: string; at: string; username: string | null; bytesIn: string; bytesOut: string; requests: number; source: string }>
}

const RANGES = [
  { id: '24h', label: '24h' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: 'all', label: 'All' },
]

export default function TrafficPage() {
  const { t } = useI18n()
  const [range, setRange] = useState('7d')
  const { data, loading, error, reload } = useApi<TrafficData>(`/api/traffic?range=${range}`)

  const hasData = data && (data.series.length > 0 || Number(data.totals.bytesIn) + Number(data.totals.bytesOut) > 0)

  return (
    <div>
      <PageHeader
        title={t('traffic.title')}
        subtitle="Real traffic records only — the panel never fabricates usage numbers."
        actions={
          <>
            <Tabs tabs={RANGES} active={range} onChange={setRange} />
            <LinkButton href="/traffic" variant="secondary" size="sm" onClick={() => void reload()}>
              {t('common.refresh')}
            </LinkButton>
          </>
        }
      />

      {loading && !data ? (
        <LoadingBlock />
      ) : error ? (
        <Card className="p-10 text-center text-sm text-danger">{error.message}</Card>
      ) : !hasData ? (
        <Card>
          <EmptyState
            title={t('empty.traffic.title')}
            description={t('empty.traffic.desc')}
          />
          <div className="mx-auto max-w-xl px-6 pb-8">
            <div className="rounded-xl bg-surface p-4 text-xs leading-relaxed text-ink-soft">
              <p className="mb-1 font-semibold text-ink">Ingest API for real data planes</p>
              <p>
                Push usage from your proxy/exporter with an API key (permission <MonoValue>traffic:ingest</MonoValue>):
              </p>
              <pre className="mono mt-2 overflow-auto rounded-lg bg-navy-900 p-3 text-[10px] leading-relaxed text-brand-light">{`POST /api/traffic/ingest
Authorization: Bearer ppk_…

{ "records": [
  { "vpnUserId": "…", "bytesIn": 120000,
    "bytesOut": 450000, "requests": 12 }
] }`}</pre>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-soft">In</p>
              <p className="num mt-2 text-2xl font-semibold text-ink">{formatBytes(data.totals.bytesIn)}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-soft">Out</p>
              <p className="num mt-2 text-2xl font-semibold text-ink">{formatBytes(data.totals.bytesOut)}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-soft">Requests</p>
              <p className="num mt-2 text-2xl font-semibold text-ink">{formatNumber(data.totals.requests)}</p>
            </Card>
          </div>

          <Reveal>
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-ink">Bandwidth</h2>
              <AreaChart
                series={data.series.map((p) => ({ t: p.t, a: p.bytesIn, b: p.bytesOut }))}
                labelA="In"
                labelB="Out"
                formatValue={(v) => formatBytes(v)}
              />
            </Card>
          </Reveal>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Reveal delay={0.05}>
              <Card className="p-5">
                <h2 className="mb-3 text-sm font-semibold text-ink">Top users</h2>
                {data.topUsers.length > 0 ? (
                  <BarChart
                    data={data.topUsers.map((u) => ({ label: u.username, value: Number(u.bytesIn) + Number(u.bytesOut) }))}
                    formatValue={(v) => formatBytes(v)}
                  />
                ) : (
                  <p className="py-8 text-center text-sm text-ink-soft">No per-user records in this range.</p>
                )}
              </Card>
            </Reveal>
            <Reveal delay={0.08}>
              <Card className="p-5">
                <h2 className="mb-3 text-sm font-semibold text-ink">Recent records</h2>
                {data.recent.length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink-soft">No records.</p>
                ) : (
                  <div className="max-h-[280px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-hairline text-start text-xs text-ink-soft">
                          <th className="py-2 text-start font-medium">Time</th>
                          <th className="py-2 text-start font-medium">User</th>
                          <th className="py-2 text-end font-medium">In</th>
                          <th className="py-2 text-end font-medium">Out</th>
                          <th className="py-2 text-end font-medium">Req</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recent.slice(0, 20).map((r) => (
                          <tr key={r.id} className="border-b border-hairline last:border-0">
                            <td className="py-2 text-xs text-ink-soft">{formatDateTime(r.at)}</td>
                            <td className="py-2 text-xs">{r.username ?? '—'}</td>
                            <td className="num py-2 text-end text-xs">{formatBytes(r.bytesIn)}</td>
                            <td className="num py-2 text-end text-xs">{formatBytes(r.bytesOut)}</td>
                            <td className="num py-2 text-end text-xs">{r.requests}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </Reveal>
          </div>
        </div>
      )}
    </div>
  )
}
