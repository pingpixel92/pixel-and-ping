'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { api, ApiClientError, type ListResponse } from '@/lib/api-client'
import { timeAgo } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { useApi } from '@/lib/hooks'
import { DataTable, type Column } from '@/components/data-table'
import { ConfirmDialog, Modal } from '@/components/modal'
import { useToast } from '@/components/toast'
import {
  Button, Field, Input, MonoValue, Select, StatusBadge, Toggle, type SemanticState,
} from '@/components/ui-primitives'
import { useMe } from '@/components/shell/auth-gate'

interface PortRow {
  id: string
  number: number
  protocol: string
  tls: boolean
  note: string | null
  status: string
  latencyMs: number | null
  lastCheckAt: string | null
  server: { id: string; name: string } | null
  vpnUsers: number
}

const PROTOCOLS = ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS', 'HTTPS', 'HTTP', 'TCP']

export default function PortsPage() {
  const { t } = useI18n()
  const toast = useToast()
  const { user } = useMe()
  const canWrite = user?.role === 'ADMIN' || user?.role === 'OPERATOR'
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useApi<ListResponse<PortRow>>(
    `/api/ports?page=${page}&pageSize=10${/^\d+$/.test(search) ? `&search=${search}` : ''}`,
  )
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PortRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PortRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [form, setForm] = useState({ number: '', protocol: 'VLESS', tls: true, note: '', serverId: '' })

  function openCreate() {
    setEditing(null)
    setForm({ number: '', protocol: 'VLESS', tls: true, note: '', serverId: '' })
    setModalOpen(true)
  }

  function openEdit(row: PortRow) {
    setEditing(row)
    setForm({ number: String(row.number), protocol: row.protocol, tls: row.tls, note: row.note ?? '', serverId: row.server?.id ?? '' })
    setModalOpen(true)
  }

  async function save() {
    setSaving(true)
    try {
      const payload = { number: Number(form.number), protocol: form.protocol, tls: form.tls, note: form.note, serverId: form.serverId }
      if (editing) {
        await api(`/api/ports/${editing.id}`, { method: 'PATCH', body: payload })
        toast.success('Port updated')
      } else {
        await api('/api/ports', { method: 'POST', body: payload })
        toast.success('Port registered', `Port ${form.number}/${form.protocol} was created.`)
      }
      setModalOpen(false)
      await reload()
    } catch (err) {
      toast.error('Save failed', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  async function test(row: PortRow) {
    setBusyId(row.id)
    try {
      const res = await api<{ ok: boolean; latencyMs: number | null; error: string | null }>(`/api/ports/${row.id}/test`, { method: 'POST' })
      if (res.ok) toast.success(`Port ${row.number} reachable`, `Latency ${res.latencyMs} ms.`)
      else toast.error(`Port ${row.number} check failed`, res.error ?? 'Unreachable.')
      await reload()
    } catch (err) {
      toast.error('Test failed', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api(`/api/ports/${deleteTarget.id}`, { method: 'DELETE' })
      toast.success('Port deleted')
      setDeleteTarget(null)
      await reload()
    } catch (err) {
      toast.error('Delete failed', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setDeleting(false)
    }
  }

  const columns: Array<Column<PortRow>> = [
    { key: 'number', header: t('ports.port'), render: (row) => <MonoValue>{row.number}</MonoValue> },
    {
      key: 'protocol',
      header: t('users.protocol'),
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 text-xs">
          {row.protocol}
          <StatusBadge state={row.tls ? 'ONLINE' : 'UNKNOWN'} label={row.tls ? t('ports.tls') : t('ports.nonTls')} />
        </span>
      ),
    },
    { key: 'server', header: t('users.server'), hideOnMobile: true, render: (row) => row.server?.name ?? <span className="text-ink-soft">—</span> },
    { key: 'users', header: 'Users', render: (row) => <span className="num text-xs">{row.vpnUsers}</span> },
    {
      key: 'status',
      header: 'Health',
      render: (row) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge state={row.status as SemanticState} />
          <span className="text-[10px] text-ink-soft">{timeAgo(row.lastCheckAt)}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'end',
      render: (row) =>
        canWrite ? (
          <div className="flex items-center justify-end gap-1.5">
            <Button variant="secondary" size="sm" onClick={() => test(row)} loading={busyId === row.id}>
              {t('common.test')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
              {t('common.edit')}
            </Button>
            <Button variant="ghost" size="sm" className="text-danger hover:bg-[rgba(220,38,38,0.07)]" onClick={() => setDeleteTarget(row)}>
              {t('common.delete')}
            </Button>
          </div>
        ) : (
          <span className="text-xs text-ink-soft">read-only</span>
        ),
    },
  ]

  return (
    <div>
      <DataTable<PortRow>
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
          title: t('empty.ports.title'),
          description: t('empty.ports.desc'),
          action: canWrite ? (
            <Button onClick={openCreate}>
              <Plus size={15} /> Add port
            </Button>
          ) : undefined,
        }}
        toolbar={
          <div className="flex flex-wrap items-center gap-2.5">
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search by port number…"
              aria-label={t('common.search')}
              className="w-52"
              inputMode="numeric"
            />
            <div className="flex-1" />
            {canWrite && (
              <Button size="sm" onClick={openCreate}>
                <Plus size={15} /> Add port
              </Button>
            )}
          </div>
        }
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit port ${editing.number}` : 'Add port'}
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
          <div className="grid grid-cols-2 gap-4">
            <Field label="Port number" htmlFor="port-number">
              <Input id="port-number" type="number" min="1" max="65535" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="8443" required />
            </Field>
            <Field label={t('users.protocol')} htmlFor="port-protocol">
              <Select id="port-protocol" value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value })}>
                {PROTOCOLS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={t('users.server')} htmlFor="port-server">
            <Select id="port-server" value={form.serverId} onChange={(e) => setForm({ ...form, serverId: e.target.value })}>
              <option value="">— None —</option>
              <PortServerOptions />
            </Select>
          </Field>
          <Field label="Note" htmlFor="port-note">
            <Input id="port-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="TLS inbound" />
          </Field>
          <label className="flex items-center gap-2.5 text-sm text-ink">
            <Toggle checked={form.tls} onChange={(v) => setForm({ ...form, tls: v })} label="TLS" />
            {t('ports.tls')}
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={`Delete port ${deleteTarget?.number ?? ''}?`}
        description="The port registration will be removed. Linked users are not deleted."
        loading={deleting}
      />
    </div>
  )
}

function PortServerOptions() {
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
