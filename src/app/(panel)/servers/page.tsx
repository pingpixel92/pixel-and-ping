'use client'

import { useEffect, useState } from 'react'
import { Plus, RefreshCcwDot, Server as ServerIcon } from 'lucide-react'
import { api, ApiClientError, type ListResponse } from '@/lib/api-client'
import { timeAgo } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { useApi } from '@/lib/hooks'
import { ConfirmDialog, Modal } from '@/components/modal'
import { useToast } from '@/components/toast'
import { Reveal } from '@/components/reveal'
import {
  Button, Card, EmptyState, Field, IconButton, Input, LinkButton, LoadingBlock, PageHeader, Select, Skeleton, StatusBadge, type SemanticState,
} from '@/components/ui-primitives'

interface ServerRow {
  id: string
  name: string
  host: string
  ip: string | null
  provider: string | null
  location: string | null
  notes: string | null
  status: string
  latencyMs: number | null
  lastCheckAt: string | null
  lastError: string | null
  vpnUsers: number
  endpoints: number
  ports: number
}

export default function ServersPage() {
  const { t } = useI18n()
  const toast = useToast()
  const { data, loading, error, reload } = useApi<ListResponse<ServerRow>>('/api/servers?pageSize=50')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ServerRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ServerRow | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState({ name: '', host: '', ip: '', provider: '', location: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem('pp_autoRefresh')
    if (stored === '1') setAutoRefresh(true)
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(() => void reload(), 60_000)
    return () => clearInterval(timer)
  }, [autoRefresh, reload])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', host: '', ip: '', provider: '', location: '', notes: '' })
    setModalOpen(true)
  }

  function openEdit(server: ServerRow) {
    setEditing(server)
    setForm({ name: server.name, host: server.host, ip: server.ip ?? '', provider: server.provider ?? '', location: server.location ?? '', notes: server.notes ?? '' })
    setModalOpen(true)
  }

  async function save() {
    setSaving(true)
    try {
      if (editing) {
        await api(`/api/servers/${editing.id}`, { method: 'PATCH', body: form })
        toast.success('Server updated')
      } else {
        await api('/api/servers', { method: 'POST', body: form })
        toast.success('Server added', `"${form.name}" was created. Run a test to determine its real status.`)
      }
      setModalOpen(false)
      await reload()
    } catch (err) {
      toast.error('Save failed', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  async function test(server: ServerRow) {
    setBusyId(server.id)
    try {
      const res = await api<{ ok: boolean; latencyMs: number | null; error: string | null }>(`/api/servers/${server.id}/test`, { method: 'POST' })
      if (res.ok) toast.success(`${server.name} is online`, `Latency ${res.latencyMs} ms (real TCP check).`)
      else toast.error(`${server.name} is offline`, res.error ?? 'Connection failed.')
      await reload()
    } catch (err) {
      toast.error('Test failed', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setBusyId(null)
    }
  }

  async function testAll() {
    setBusyId('all')
    try {
      await api('/api/servers/test-all', { method: 'POST' })
      toast.success('Status refresh complete', 'All servers and endpoints were checked.')
      await reload()
    } catch (err) {
      toast.error('Refresh failed', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api(`/api/servers/${deleteTarget.id}`, { method: 'DELETE' })
      toast.success('Server deleted')
      setDeleteTarget(null)
      await reload()
    } catch (err) {
      toast.error('Delete failed', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={t('servers.title')}
        subtitle="Status comes from real TCP health checks — never fabricated."
        actions={
          <>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--brand)]" />
              {t('common.autoRefresh')}
            </label>
            <Button variant="secondary" size="sm" onClick={testAll} loading={busyId === 'all'}>
              <RefreshCcwDot size={14} /> Refresh statuses
            </Button>
            <LinkButton href="/servers" size="sm" variant="secondary">
              {t('common.refresh')}
            </LinkButton>
            <Button size="sm" onClick={openCreate}>
              <Plus size={15} /> Add server
            </Button>
          </>
        }
      />

      {loading && !data ? (
        <LoadingBlock />
      ) : error && !data ? (
        <EmptyState title="Could not load servers" description={error.message} />
      ) : !data || data.items.length === 0 ? (
        <Card>
          <EmptyState
            title={t('empty.servers.title')}
            description={t('empty.servers.desc')}
            action={
              <Button onClick={openCreate}>
                <Plus size={15} /> Add server
              </Button>
            }
            icon={<ServerIcon size={24} />}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((server, i) => (
            <Reveal key={server.id} delay={Math.min(i * 0.05, 0.3)}>
              <Card className="p-5" hover>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-ink">{server.name}</h3>
                    <p className="mono mt-0.5 truncate text-xs text-ink-soft">{server.ip || server.host}</p>
                  </div>
                  <StatusBadge state={server.status as SemanticState} />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Metric label="Users" value={server.vpnUsers} />
                  <Metric label="Endpoints" value={server.endpoints} />
                  <Metric label="Ports" value={server.ports} />
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3.5 text-[11px] text-ink-soft">
                  <span>
                    {server.latencyMs !== null ? `${server.latencyMs} ms` : 'no data'} · {timeAgo(server.lastCheckAt)}
                  </span>
                  {server.provider && <span className="truncate">{server.provider}</span>}
                </div>
                {server.lastError && <p className="mt-2 truncate text-[11px] text-danger" title={server.lastError}>{server.lastError}</p>}

                <div className="mt-4 flex items-center gap-1.5">
                  <Button variant="secondary" size="sm" onClick={() => test(server)} loading={busyId === server.id}>
                    {t('servers.testConnection')}
                  </Button>
                  <div className="flex-1" />
                  <Button variant="ghost" size="sm" onClick={() => openEdit(server)}>
                    {t('common.edit')}
                  </Button>
                  <IconButton label={`Delete ${server.name}`} onClick={() => setDeleteTarget(server)} className="text-danger hover:bg-[rgba(220,38,38,0.07)]">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                  </IconButton>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Add server'}
        description="Host is used for real health checks."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={save} loading={saving}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" htmlFor="srv-name">
            <Input id="srv-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="edge-fra-01" required />
          </Field>
          <Field label="Host" htmlFor="srv-host" hint="Hostname or IP — probed with TCP on the first endpoint port (or 443).">
            <Input id="srv-host" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="1.2.3.4" required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="IP (optional)" htmlFor="srv-ip">
              <Input id="srv-ip" value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} placeholder="1.2.3.4" />
            </Field>
            <Field label="Provider (optional)" htmlFor="srv-provider">
              <Input id="srv-provider" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="Hetzner" />
            </Field>
          </div>
          <Field label="Location (optional)" htmlFor="srv-location">
            <Input id="srv-location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Frankfurt, DE" />
          </Field>
          <Field label="Notes" htmlFor="srv-notes">
            <Input id="srv-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={`Delete "${deleteTarget?.name ?? ''}"?`}
        description="Endpoints and ports linked to this server will be unlinked. Users keep their history."
        loading={deleting}
      />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-surface py-2">
      <p className="num text-base font-semibold text-ink">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-ink-soft">{label}</p>
    </div>
  )
}
