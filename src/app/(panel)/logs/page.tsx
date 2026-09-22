'use client'

import { useState } from 'react'
import { formatDateTime } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { useApi } from '@/lib/hooks'
import type { ListResponse } from '@/lib/api-client'
import { DataTable, type Column } from '@/components/data-table'
import { Badge, Input, Select } from '@/components/ui-primitives'

interface LogRow {
  id: string
  at: string
  level: string
  action: string
  actor: string | null
  resourceType: string | null
  resourceId: string | null
  message: string
  ip: string | null
}

export default function LogsPage() {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  const query = new URLSearchParams({
    page: String(page),
    pageSize: '15',
    ...(search ? { search } : {}),
    ...(level !== 'ALL' ? { level } : {}),
    ...(from ? { from: new Date(from).toISOString() } : {}),
    ...(to ? { to: new Date(to).toISOString() } : {}),
  }).toString()

  const { data, loading, error, reload } = useApi<ListResponse<LogRow>>(`/api/logs?${query}`)

  const columns: Array<Column<LogRow>> = [
    { key: 'at', header: 'Time', render: (row) => <span className="whitespace-nowrap text-xs text-ink-soft">{formatDateTime(row.at)}</span> },
    {
      key: 'level',
      header: 'Level',
      render: (row) => (
        <Badge tone={row.level === 'ERROR' ? 'brand' : row.level === 'WARN' ? 'neutral' : 'neutral'}>
          {row.level}
        </Badge>
      ),
    },
    { key: 'action', header: 'Action', render: (row) => <span className="mono text-xs">{row.action}</span> },
    { key: 'actor', header: 'User', hideOnMobile: true, render: (row) => row.actor ?? '—' },
    {
      key: 'message',
      header: 'Message',
      render: (row) => (
        <span className="block max-w-[420px] truncate text-xs text-ink" title={row.message}>
          {row.message}
        </span>
      ),
    },
    { key: 'ip', header: 'IP', hideOnMobile: true, render: (row) => <span className="mono text-xs text-ink-soft">{row.ip ?? '—'}</span> },
  ]

  return (
    <DataTable<LogRow>
      columns={columns}
      rows={data?.items ?? []}
      rowKey={(row) => row.id}
      loading={loading}
      error={error?.message ?? null}
      onRetry={reload}
      page={data?.page}
      pageSize={data?.pageSize}
      total={data?.total}
      onPage={setPage}
      empty={{
        title: t('empty.logs.title'),
        description: t('empty.logs.desc'),
      }}
      toolbar={
        <div className="flex flex-wrap items-center gap-2.5">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder={`${t('common.search')}…`}
            aria-label={t('common.search')}
            className="w-52"
          />
          <Select
            value={level}
            onChange={(e) => {
              setLevel(e.target.value)
              setPage(1)
            }}
            aria-label="Severity"
            className="w-32"
          >
            <option value="ALL">All levels</option>
            <option value="DEBUG">DEBUG</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
          </Select>
          <Input
            type="datetime-local"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              setPage(1)
            }}
            aria-label="From"
            className="w-52"
          />
          <Input
            type="datetime-local"
            value={to}
            onChange={(e) => {
              setTo(e.target.value)
              setPage(1)
            }}
            aria-label="To"
            className="w-52"
          />
        </div>
      }
    />
  )
}
