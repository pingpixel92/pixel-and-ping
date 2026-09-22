'use client'

import { useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { api, ApiClientError, type ListResponse } from '@/lib/api-client'
import { timeAgo } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { useApi } from '@/lib/hooks'
import { useToast } from '@/components/toast'
import { useMe } from '@/components/shell/auth-gate'
import {
  Badge, Button, Card, EmptyState, LoadingBlock, PageHeader, Select,
} from '@/components/ui-primitives'

interface NotificationRow {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
}

const TYPES = ['ALL', 'SYSTEM', 'EXPIRY', 'HEALTH', 'INTEGRATION']

export default function NotificationsPage() {
  const { t } = useI18n()
  const toast = useToast()
  const { setUnreadCount } = useMe()
  const [type, setType] = useState('ALL')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [markingAll, setMarkingAll] = useState(false)

  const query = new URLSearchParams({
    page: String(page),
    pageSize: '15',
    ...(type !== 'ALL' ? { type } : {}),
    ...(unreadOnly ? { unreadOnly: '1' } : {}),
  }).toString()

  const { data, loading, error, reload } = useApi<ListResponse<NotificationRow>>(`/api/notifications?${query}`)

  async function markAll() {
    setMarkingAll(true)
    try {
      const res = await api<{ unreadCount: number }>('/api/notifications/read-all', { method: 'POST' })
      setUnreadCount(res.unreadCount)
      toast.success('All notifications marked as read')
      await reload()
    } catch (err) {
      toast.error('Failed', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setMarkingAll(false)
    }
  }

  async function markOne(id: string) {
    try {
      const res = await api<{ unreadCount: number }>('/api/notifications', {
        method: 'PATCH',
        body: { ids: [id] },
      })
      setUnreadCount(res.unreadCount)
      await reload()
    } catch (err) {
      toast.error('Failed', err instanceof ApiClientError ? err.message : undefined)
    }
  }

  return (
    <div>
      <PageHeader
        title={t('notifications.title')}
        subtitle="Persistent alerts stored in PostgreSQL — expiry, health, integration and system events."
        actions={
          <Button variant="secondary" size="sm" onClick={markAll} loading={markingAll}>
            <CheckCheck size={14} /> Mark all read
          </Button>
        }
      />

      {loading && !data ? (
        <LoadingBlock />
      ) : error ? (
        <Card className="p-10 text-center text-sm text-danger">{error.message}</Card>
      ) : !data || data.items.length === 0 ? (
        <Card>
          <EmptyState
            title={t('empty.notifications.title')}
            description={t('empty.notifications.desc')}
            icon={<Bell size={24} />}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1) }} aria-label="Type" className="w-44">
              {TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {ty === 'ALL' ? 'All types' : ty}
                </option>
              ))}
            </Select>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1) }} className="h-4 w-4 accent-[var(--brand)]" />
              Unread only
            </label>
            <div className="flex-1" />
            <span className="text-xs text-ink-soft">
              {data.unreadCount} unread · {data.total} total
            </span>
          </div>

          <Card>
            <ul className="divide-y divide-hairline">
              {data.items.map((n) => (
                <li key={n.id} className={`flex flex-wrap items-start justify-between gap-3 px-5 py-4 ${n.read ? '' : 'bg-[rgba(37,99,201,0.035)]'}`}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-sm ${n.read ? 'font-medium text-ink' : 'font-semibold text-ink'}`}>{n.title}</p>
                      <Badge tone={n.type === 'HEALTH' ? 'brand' : 'neutral'}>{n.type}</Badge>
                      {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-label="unread" />}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-ink-soft">{n.message}</p>
                    <p className="mt-1 text-[10px] text-ink-soft">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <Button variant="ghost" size="sm" onClick={() => markOne(n.id)}>
                      Mark read
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {data.total > data.pageSize && (
              <div className="flex items-center justify-between border-t border-hairline px-5 py-3 text-xs text-ink-soft">
                <span>
                  Page {data.page} / {Math.ceil(data.total / data.pageSize)}
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Prev
                  </Button>
                  <Button variant="secondary" size="sm" disabled={page >= Math.ceil(data.total / data.pageSize)} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
