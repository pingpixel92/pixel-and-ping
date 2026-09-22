'use client'

import { useState } from 'react'
import { Plus, Waypoints } from 'lucide-react'
import { api, ApiClientError, type ListResponse } from '@/lib/api-client'
import { timeAgo } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { useApi } from '@/lib/hooks'
import { DataTable, type Column } from '@/components/data-table'
import { ConfirmDialog, Modal } from '@/components/modal'
import { useToast } from '@/components/toast'
import {
  Button, Field, Input, LinkButton, MonoValue, Select, StatusBadge, Toggle, type SemanticState,
} from '@/components/ui-primitives'

interface EndpointRow {
  id: string
  name: string
  address: string
  port: number
  protocol: string
  tls: boolean
  sni: string | null
  enabled: boolean
  status: string
  latencyMs: number | null
  lastCheckAt: string | null
  lastError: string | null
  server: { id: string; name: string } | null
  vpnUsers: number
}

const PROTOCOLS = ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS', 'HTTPS', 'HTTP', 'TCP']

export default function EndpointsPage() {
  const { t } = useI18n()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useApi<ListResponse<EndpointRow>>(
    `/api/endpoints?page=${page}&pageSize=10${search ? `&search=${encodeURIComponent(search)}` : ''}`,
  )
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<EndpointRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<EndpointRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', address: '', port: '', protocol: 'VLESS', tls: true, sni: '', serverId: '', enabled: true })

  function openCreate() {
    setEditing(null)
    setForm({ name: '', address: '', port: '', protocol: 'VLESS', tls: true, sni: '', serverId: '', enabled: true })
    setModalOpen(true)
  }

  function openEdit(row: EndpointRow) {
    setEditing(row)
    setForm({ name: row.name, address: row.address, port: String(row.port), protocol: row.protocol, tls: row.tls, sni: row.sni ?? '', serverId: row.server?.id ?? '', enabled: row.enabled })
    setModalOpen(true)
  }

  async function save() {
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        address: form.address,
        port: Number(form.port),
        protocol: form.protocol,
        tls: form.tls,
        sni: form.sni,
        serverId: form.serverId,
        enabled: form.enabled,
      }
      if (editing) {
        await api(`/api/endpoints/${editing.id}`, { method: 'PATCH', body: payload })
        toast.success('Endpoint updated')
      } else {
        await api('/api/endpoints', { method: 'POST', body: payload })
        toast.success('Endpoint created')
      }
      setModalOpen(false)
      await reload()
    } catch (err) {
      toast.error('Save failed', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  async function test(row: EndpointRow) {
    setBusyId(row.id)
    try {
      const res = await api<{ ok: boolean; latencyMs: number | null; error: string | null }>(`/api/endpoints/${row.id}/test`, { method: 'POST' })
      if (res.ok) toast.success(`${row.name} is online`, `Latency ${res.latencyMs} ms (real ${row.tls ? 'TLS handshake' : 'TCP'} check).`)
      else toast.error(`${row.name} is offline`, res.error ?? 'Connection failed.')
      await reload()
    } catch (err) {
      toast.error('Test failed', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setBusyId(null)
    }
  }

  async function toggleEnabled(row: EndpointRow) {
    try {
      await api(`/api/endpoints/${row.id}`, { method: 'PATCH', body: { enabled: !row.enabled } })
      toast.success(row.enabled ? 'Endpoint disabled' : 'Endpoint enabled')
      await reload()
    } catch (err) {
      toast.error('Update failed', err instanceof ApiClientError ? err.message : undefined)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api(`/api/endpoints/${deleteTarget.id}`, { method: 'DELETE' })
      toast.success('Endpoint deleted')
      setDeleteTarget(null)
      await reload()
    } catch (err) {
      toast.error('Delete failed', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setDeleting(false)
    }
  }

  const columns: Array<Column<EndpointRow>> = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div>
          <span className="block font-medium text-ink">{row.name}</span>
          {!row.enabled && <span className="text-[11px] text-ink-soft">disabled</span>}
        </div>
      ),
    },
    {
      key: 'address',
      header: t('endpoints.address'),
      render: (row) => (
        <MonoValue>
          {row.address}:{row.port}
        </MonoValue>
      ),
    },
    { key: 'protocol', header: t('users.protocol'), render: (row) => <span className="text-xs">{row.protocol}{row.tls ? ' · TLS' : ''}</span> },
    { key: 'server', header: t('users.server'), hideOnMobile: true, render: (row) => row.server?.name ?? <span className="text-ink-soft">—</span> },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge state={row.status as SemanticState} />
          <span className="text-[10px] text-ink-soft">{timeAgo(row.lastCheckAt)}</span>
        </div>
      ),
    },
    {
      key: 'latency',
      header: t('servers.latency'),
      align: 'end',
      hideOnMobile: true,
      render: (row) => <span className="num text-xs">{row.latencyMs !== null ? `${row.latencyMs} ms` : '—'}</span>,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'end',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => test(row)} loading={busyId === row.id} disabled={!row.enabled}>
            {t('common.test')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => toggleEnabled(row)}>
            {row.enabled ? t('common.disable') : t('common.enable')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            {t('common.edit')}
          </Button>
          <Button variant="ghost" size="sm" className="text-danger hover:bg-[rgba(220,38,38,0.07)]" onClick={() => setDeleteTarget(row)}>
            {t('common.delete')}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <DataTable<EndpointRow>
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
          title: t('empty.endpoints.title'),
          description: t('empty.endpoints.desc'),
          action: (
            <Button onClick={openCreate}>
              <Plus size={15} /> Add endpoint
            </Button>
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
            <div className="flex-1" />
            <LinkButton href="/servers" variant="secondary" size="sm">
              {t('nav.servers')}
            </LinkButton>
            <Button size="sm" onClick={openCreate}>
              <Plus size={15} /> Add endpoint
            </Button>
          </div>
        }
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Add endpoint'}
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
          <Field label="Name" htmlFor="ep-name">
            <Input id="ep-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="vless-entry" required />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Address" htmlFor="ep-address" className="col-span-2">
              <Input id="ep-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="vpn.example.com" required />
            </Field>
            <Field label="Port" htmlFor="ep-port">
              <Input id="ep-port" type="number" min="1" max="65535" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} placeholder="443" required />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('users.protocol')} htmlFor="ep-protocol">
              <Select id="ep-protocol" value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value })}>
                {PROTOCOLS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('users.server')} htmlFor="ep-server">
              <Select id="ep-server" value={form.serverId} onChange={(e) => setForm({ ...form, serverId: e.target.value })}>
                <option value="">— None —</option>
                <EndpointServerOptions />
              </Select>
            </Field>
          </div>
          <Field label="SNI (optional, TLS)" htmlFor="ep-sni">
            <Input id="ep-sni" value={form.sni} onChange={(e) => setForm({ ...form, sni: e.target.value })} placeholder="cdn.example.com" />
          </Field>
          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2.5 text-sm text-ink">
              <Toggle checked={form.tls} onChange={(v) => setForm({ ...form, tls: v })} label="TLS" />
              TLS
            </label>
            <label className="flex items-center gap-2.5 text-sm text-ink">
              <Toggle checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} label="Enabled" />
              Enabled
            </label>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={`Delete "${deleteTarget?.name ?? ''}"?`}
        description="Users assigned to this endpoint will keep their profile but lose the connection target."
        loading={deleting}
      />
    </div>
  )
}

function EndpointServerOptions() {
  const { data } = useApi<ListResponse<{ id: string; name: string }>>('/api/servers?pageSize=100')
  return (
    <>
      {(data?.items ?? []).map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </>
  )
}
