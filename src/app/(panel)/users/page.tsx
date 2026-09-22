'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UserPlus } from 'lucide-react'
import { api, ApiClientError, type ListResponse } from '@/lib/api-client'
import { formatBytes, formatDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { useApi } from '@/lib/hooks'
import { DataTable, type Column } from '@/components/data-table'
import { ConfirmDialog } from '@/components/modal'
import { useToast } from '@/components/toast'
import { Button, Input, LinkButton, MonoValue, Select, StatusBadge, type SemanticState } from '@/components/ui-primitives'

interface VpnUserRow {
  id: string
  username: string
  displayName: string | null
  status: string
  protocol: string
  hasConfig: boolean
  server: { id: string; name: string } | null
  endpoint: { id: string; name: string } | null
  port: { id: string; number: number } | null
  expiresAt: string | null
  trafficLimitBytes: string | null
  usedBytes: string
  createdAt: string
}

function displayState(row: VpnUserRow): SemanticState {
  if (row.status === 'DISABLED') return 'DISABLED'
  if (row.status === 'EXPIRED') return 'EXPIRED'
  if (!row.expiresAt) return 'ACTIVE'
  if (new Date(row.expiresAt) < new Date()) return 'EXPIRED'
  if (new Date(row.expiresAt) < new Date(Date.now() + 7 * 86_400_000)) return 'EXPIRING_SOON'
  return 'ACTIVE'
}

export default function UsersPage() {
  const { t } = useI18n()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ALL')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<{ key: string; order: 'asc' | 'desc' }>({ key: 'createdAt', order: 'desc' })
  const [deleteTarget, setDeleteTarget] = useState<VpnUserRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const query = new URLSearchParams({
    page: String(page),
    pageSize: '10',
    ...(search ? { search } : {}),
    ...(status !== 'ALL' ? { status } : {}),
    sort: sort.key,
    order: sort.order,
  }).toString()

  const { data, loading, error, reload } = useApi<ListResponse<VpnUserRow>>(`/api/users?${query}`)

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api(`/api/users/${deleteTarget.id}`, { method: 'DELETE' })
      toast.success('User deleted', `"${deleteTarget.username}" was removed.`)
      setDeleteTarget(null)
      await reload()
    } catch (err) {
      toast.error('Delete failed', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setDeleting(false)
    }
  }

  const columns: Array<Column<VpnUserRow>> = [
    {
      key: 'username',
      header: t('users.username'),
      sortable: true,
      render: (row) => (
        <Link href={`/users/${row.id}`} className="group inline-block">
          <span className="block font-medium text-ink group-hover:text-brand">{row.displayName || row.username}</span>
          <MonoValue className="mt-0.5 inline-block">{row.username}</MonoValue>
        </Link>
      ),
    },
    { key: 'status', header: t('common.status'), render: (row) => <StatusBadge state={displayState(row)} /> },
    {
      key: 'server',
      header: t('users.server'),
      hideOnMobile: true,
      render: (row) => row.server?.name ?? <span className="text-ink-soft">—</span>,
    },
    {
      key: 'endpoint',
      header: t('users.endpoint'),
      hideOnMobile: true,
      render: (row) =>
        row.endpoint ? (
          row.endpoint.name
        ) : row.port ? (
          <MonoValue>:{row.port.number}</MonoValue>
        ) : (
          <span className="text-ink-soft">—</span>
        ),
    },
    { key: 'createdAt', header: t('users.created'), sortable: true, hideOnMobile: true, render: (row) => formatDate(row.createdAt) },
    {
      key: 'expiresAt',
      header: t('users.expires'),
      sortable: true,
      render: (row) => (row.expiresAt ? formatDate(row.expiresAt) : <StatusBadge state="UNLIMITED" label="∞" />),
    },
    {
      key: 'traffic',
      header: t('users.traffic'),
      align: 'end',
      render: (row) => (
        <span className="num text-xs">
          {formatBytes(row.usedBytes)}
          {row.trafficLimitBytes ? ` / ${formatBytes(row.trafficLimitBytes)}` : ''}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'end',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <LinkButton href={`/users/${row.id}`} variant="ghost" size="sm">
            {t('common.view')}
          </LinkButton>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger hover:bg-[rgba(220,38,38,0.07)]"
            onClick={() => setDeleteTarget(row)}
          >
            {t('common.delete')}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <DataTable<VpnUserRow>
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        loading={loading}
        error={error?.message ?? null}
        onRetry={reload}
        sort={sort}
        onSortChange={(key) =>
          setSort((prev) => ({ key, order: prev.key === key && prev.order === 'desc' ? 'asc' : 'desc' }))
        }
        page={data?.page}
        pageSize={data?.pageSize}
        total={data?.total}
        onPage={setPage}
        empty={{
          title: t('empty.users.title'),
          description: t('empty.users.desc'),
          action: (
            <LinkButton href="/users/create">
              <UserPlus size={15} /> {t('nav.createUser')}
            </LinkButton>
          ),
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
              className="w-56"
            />
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
              aria-label={t('common.status')}
              className="w-44"
            >
              <option value="ALL">{t('common.all')}</option>
              <option value="ACTIVE">{t('status.ACTIVE')}</option>
              <option value="DISABLED">{t('status.DISABLED')}</option>
              <option value="EXPIRED">{t('status.EXPIRED')}</option>
              <option value="EXPIRING_SOON">{t('status.EXPIRING_SOON')}</option>
            </Select>
            <div className="flex-1" />
            <LinkButton href="/users/create" size="sm">
              <UserPlus size={15} /> {t('nav.createUser')}
            </LinkButton>
          </div>
        }
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.username ?? ''}"?`}
        description="The user and all stored configurations will be permanently removed."
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
