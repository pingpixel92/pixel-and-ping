'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, FileCode2, RefreshCw } from 'lucide-react'
import { api, ApiClientError } from '@/lib/api-client'
import { formatBytes, formatDateTime } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { useApi } from '@/lib/hooks'
import { ConfirmDialog } from '@/components/modal'
import { useToast } from '@/components/toast'
import { Reveal } from '@/components/reveal'
import {
  Button, Card, CopyButton, EmptyState, ErrorBlock, LoadingBlock, MonoValue, PageHeader, StatusBadge, type SemanticState,
} from '@/components/ui-primitives'

interface UserDetail {
  user: {
    id: string
    username: string
    displayName: string | null
    email: string | null
    status: string
    effectiveStatus: string
    protocol: string
    hasConfig: boolean
    configUpdatedAt: string | null
    server: { id: string; name: string } | null
    endpoint: { id: string; name: string } | null
    port: { id: string; number: number } | null
    expiresAt: string | null
    trafficLimitBytes: string | null
    usedBytes: string
    notes: string | null
    createdAt: string
    createdBy: string | null
  }
  configs: Array<{ id: string; name: string; protocol: string; createdAt: string }>
  activity: Array<{ id: string; at: string; action: string; actorLabel: string }>
  logs: Array<{ id: string; at: string; level: string; action: string; message: string }>
}

export default function UserDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const toast = useToast()
  const { t } = useI18n()
  const { data, loading, error, reload } = useApi<UserDetail>(`/api/users/${params.id}`)
  const [config, setConfig] = useState<string | null>(null)
  const [busy, setBusy] = useState<'regenerate' | 'delete' | 'toggle' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const user = data?.user

  // Load the current stored config (for copy/display) once the user is loaded.
  useEffect(() => {
    if (!data?.user?.hasConfig || config) return
    api<{ config: string | null }>(`/api/users/${params.id}/config`)
      .then((res) => setConfig(res.config))
      .catch(() => undefined)
  }, [data?.user?.hasConfig, params.id, config])

  async function regenerate() {
    setBusy('regenerate')
    try {
      const res = await api<{ config: string }>(`/api/users/${params.id}/config`, { method: 'POST' })
      setConfig(res.config)
      toast.success('Config regenerated', 'New credentials were issued.')
      await reload()
    } catch (err) {
      toast.error('Regeneration failed', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  async function toggleStatus() {
    if (!user) return
    setBusy('toggle')
    try {
      await api(`/api/users/${params.id}`, {
        method: 'PATCH',
        body: { status: user.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED' },
      })
      toast.success(user.status === 'DISABLED' ? 'User enabled' : 'User disabled')
      await reload()
    } catch (err) {
      toast.error('Update failed', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  async function deleteUser() {
    setBusy('delete')
    try {
      await api(`/api/users/${params.id}`, { method: 'DELETE' })
      toast.success('User deleted')
      router.push('/users')
    } catch (err) {
      toast.error('Delete failed', err instanceof ApiClientError ? err.message : undefined)
      setBusy(null)
      setConfirmDelete(false)
    }
  }

  if (loading && !data) return <LoadingBlock />
  if (error) return <ErrorBlock message={error.message} onRetry={reload} />
  if (!user) return <EmptyState title="Not found" description="This user does not exist." />

  const usedPct =
    user.trafficLimitBytes && Number(user.trafficLimitBytes) > 0
      ? Math.min(100, (Number(user.usedBytes) / Number(user.trafficLimitBytes)) * 100)
      : 0

  const state = user.status === 'DISABLED' ? 'DISABLED' : user.effectiveStatus

  return (
    <div>
      <Link href="/users" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-ink">
        <ArrowLeft size={15} /> {t('nav.users')}
      </Link>

      <PageHeader
        title={user.displayName || user.username}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <MonoValue>{user.username}</MonoValue>
            <StatusBadge state={state as SemanticState} />
            <span className="text-xs">· {user.protocol}</span>
          </span>
        }
        actions={
          <>
            <Button variant="secondary" onClick={toggleStatus} loading={busy === 'toggle'}>
              {user.status === 'DISABLED' ? t('common.enable') : t('common.disable')}
            </Button>
            <Button variant="secondary" onClick={regenerate} loading={busy === 'regenerate'}>
              <RefreshCw size={14} /> {t('users.regenerate')}
            </Button>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              {t('common.delete')}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Profile */}
        <Reveal className="lg:col-span-1">
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-ink">Profile</h2>
            <dl className="space-y-3 text-sm">
              <Row label="Email" value={user.email ?? '—'} />
              <Row label={t('users.server')} value={user.server?.name ?? '—'} />
              <Row label={t('users.endpoint')} value={user.endpoint?.name ?? (user.port ? `Port ${user.port.number}` : '—')} />
              <Row label={t('users.expires')} value={user.expiresAt ? formatDateTime(user.expiresAt) : '∞'} />
              <Row label={t('users.created')} value={formatDateTime(user.createdAt)} />
              <Row label="Created by" value={user.createdBy ?? '—'} />
              {user.notes && <Row label={t('users.notes')} value={user.notes} />}
            </dl>

            <div className="mt-5 border-t border-hairline pt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-ink-soft">{t('users.traffic')}</span>
                <span className="num font-medium text-ink">
                  {formatBytes(user.usedBytes)}
                  {user.trafficLimitBytes ? ` / ${formatBytes(user.trafficLimitBytes)}` : ' / ∞'}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface">
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${usedPct}%` }} />
              </div>
            </div>
          </Card>
        </Reveal>

        {/* Config */}
        <Reveal className="lg:col-span-2" delay={0.06}>
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <FileCode2 size={15} className="text-brand" /> Configuration
              </h2>
              <div className="flex items-center gap-2">
                <CopyButton text={config} label={t('users.copyConfig')} />
                <Button variant="secondary" size="sm" onClick={regenerate} loading={busy === 'regenerate'}>
                  {t('users.regenerate')}
                </Button>
              </div>
            </div>

            {!user.hasConfig ? (
              <EmptyState
                title="No configuration yet"
                description="Assign a server or endpoint, then regenerate to produce a real client configuration."
                action={
                  <Button variant="secondary" size="sm" onClick={regenerate} loading={busy === 'regenerate'}>
                    <RefreshCw size={14} /> Generate now
                  </Button>
                }
              />
            ) : (
              <pre className="mono max-h-56 overflow-auto rounded-xl bg-navy-900 p-4 text-[11px] leading-relaxed text-brand-light">
                {config ?? 'Loading config…'}
              </pre>
            )}

            {user.configUpdatedAt && <p className="mt-2 text-[11px] text-ink-soft">Updated {formatDateTime(user.configUpdatedAt)}</p>}

            {data.configs.length > 0 && (
              <div className="mt-4 border-t border-hairline pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">History</p>
                <ul className="space-y-1.5">
                  {data.configs.slice(0, 5).map((c) => (
                    <li key={c.id} className="flex items-center justify-between text-xs">
                      <MonoValue>{c.name}</MonoValue>
                      <span className="text-ink-soft">{formatDateTime(c.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </Reveal>

        {/* Activity + logs */}
        <Reveal className="lg:col-span-3" delay={0.1}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-ink">Activity</h2>
              {data.activity.length === 0 ? (
                <p className="py-4 text-sm text-ink-soft">No activity recorded yet.</p>
              ) : (
                <ul className="divide-y divide-hairline">
                  {data.activity.map((a) => (
                    <li key={a.id} className="flex items-center justify-between py-2 text-xs first:pt-0 last:pb-0">
                      <span className="font-medium text-ink">{a.action}</span>
                      <span className="text-ink-soft">
                        {a.actorLabel} · {formatDateTime(a.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-ink">Logs</h2>
              {data.logs.length === 0 ? (
                <p className="py-4 text-sm text-ink-soft">No logs for this user yet.</p>
              ) : (
                <ul className="divide-y divide-hairline">
                  {data.logs.map((l) => (
                    <li key={l.id} className="py-2 text-xs first:pt-0 last:pb-0">
                      <p className="text-ink">{l.message}</p>
                      <p className="mt-0.5 text-ink-soft">
                        {l.action} · {formatDateTime(l.at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </Reveal>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={deleteUser}
        title={`Delete "${user.username}"?`}
        description="All configurations and history for this user will be permanently removed."
        loading={busy === 'delete'}
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-xs text-ink-soft">{label}</dt>
      <dd className="max-w-[60%] break-words text-end text-xs font-medium text-ink">{value}</dd>
    </div>
  )
}
