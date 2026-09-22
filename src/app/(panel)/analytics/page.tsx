'use client'

import { useState } from 'react'
import { formatNumber, timeAgo } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { useApi } from '@/lib/hooks'
import { AreaChart, BarChart } from '@/components/charts'
import { Reveal } from '@/components/reveal'
import { Card, EmptyState, LoadingBlock, PageHeader, StatCard, Tabs } from '@/components/ui-primitives'

interface AnalyticsData {
  range: string
  totals: { events: number; errors: number; logins: number; scans: number; configsGenerated: number }
  byType: Array<{ type: string; count: number }>
  series: Array<{ t: string; total: number; errors: number }>
  activeSessions: number
}

const RANGES = [
  { id: '24h', label: '24h' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: 'all', label: 'All' },
]

export default function AnalyticsPage() {
  const { t } = useI18n()
  const [range, setRange] = useState('7d')
  const { data, loading, error } = useApi<AnalyticsData>(`/api/analytics?range=${range}`)

  return (
    <div>
      <PageHeader
        title={t('analytics.title')}
        subtitle="Every metric is computed from stored events with real database queries."
        actions={<Tabs tabs={RANGES} active={range} onChange={setRange} />}
      />

      {loading && !data ? (
        <LoadingBlock />
      ) : error ? (
        <Card className="p-10 text-center text-sm text-danger">{error.message}</Card>
      ) : !data || data.totals.events === 0 ? (
        <Card>
          <EmptyState
            title="No analytics data yet"
            description="Events are recorded as the panel is used — sign-ins, scans, health checks and config operations."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Events" value={formatNumber(data.totals.events)} hint={`${data.activeSessions} active sessions`} />
            <StatCard label="Errors" value={formatNumber(data.totals.errors)} />
            <StatCard label="Sign-ins" value={formatNumber(data.totals.logins)} />
            <StatCard label="Scans" value={formatNumber(data.totals.scans)} hint={`${data.totals.configsGenerated} configs generated`} />
          </div>

          <Reveal>
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-ink">Events over time</h2>
              <AreaChart
                series={data.series.map((p) => ({ t: p.t, a: p.total, b: p.errors }))}
                labelA="All events"
                labelB="Errors"
              />
            </Card>
          </Reveal>

          <Reveal delay={0.05}>
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-ink">By type</h2>
              <BarChart data={data.byType.slice(0, 8).map((g) => ({ label: g.type, value: g.count }))} />
            </Card>
          </Reveal>
        </div>
      )}
    </div>
  )
}
