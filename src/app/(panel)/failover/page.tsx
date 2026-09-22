'use client'

import { useState } from 'react'
import { Plus, RefreshCw, Shuffle, Trash2 } from 'lucide-react'
import { api, ApiClientError } from '@/lib/api-client'
import { timeAgo } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { useApi } from '@/lib/hooks'
import { ConfirmDialog, Modal } from '@/components/modal'
import { useToast } from '@/components/toast'
import { Reveal } from '@/components/reveal'
import {
  Button, Card, EmptyState, Field, Input, LoadingBlock, PageHeader, Select, StatusBadge, type SemanticState,
} from '@/components/ui-primitives'
import { useMe } from '@/components/shell/auth-gate'

interface EndpointLite {
  id: string
  name: string
  address: string
  port: number
  status: string
}

interface Rule {
  id: string
  name: string
  primaryEndpoint: EndpointLite | null
  backupEndpoint: EndpointLite | null
  checkIntervalSec: number
  failureThreshold: number
  recoveryThreshold: number
  enabled: boolean
  state: string
  consecutiveFailures: number
  lastCheckedAt: string | null
  lastNote: string | null
}

export default function FailoverPage() {
  const { t } = useI18n()
  const toast = useToast()
  const { user } = useMe()
  const canWrite = user?.role === 'ADMIN' || user?.role === 'OPERATOR'

  const rules = useApi<{ items: Rule[] }>('/api/failover')
  const endpoints = useApi<{ items: EndpointLite[] }>('/api/endpoints?pageSize=100')

  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Rule | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    primaryEndpointId: '',
    backupEndpointId: '',
    checkIntervalSec: '60',
    failureThreshold: '3',
    recoveryThreshold: '2',
    enabled: true,
  })

  function openCreate() {
    setForm({ name: '', primaryEndpointId: '', backupEndpointId: '', checkIntervalSec: '60', failureThreshold: '3', recoveryThreshold: '2', enabled: true })
    setModalOpen(true)
  }

  async function save() {
    setSaving(true)
    try {
      await api('/api/failover', {
        method: 'POST',
        body: {
          name: form.name,
          primaryEndpointId: form.primaryEndpointId,
          backupEndpointId: form.backupEndpointId,
          checkIntervalSec: Number(form.checkIntervalSec),
          failureThreshold: Number(form.failureThreshold),
          recoveryThreshold: Number(form.recoveryThreshold),
          enabled: form.enabled,
        },
      })
      toast.success('Failover rule created', 'Run a check to evaluate the real state.')
      setModalOpen(false)
      await rules.reload()
    } catch (err) {
      toast.error('Create failed', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  async function checkNow(rule: Rule) {
    setBusyId(rule.id)
    try {
      const res = await api<{ rule: Rule }>(`/api/failover/${rule.id}/check`, { method: 'POST' })
      const state = res.rule?.state ?? 'NOT_CHECKED'
      if (state === 'HEALTHY') toast.success(`${rule.name}: primary healthy`)
      else if (state === 'FAILED') toast.error(`${rule.name}: FAILED`, res.rule?.lastNote ?? undefined)
      else toast.info(`${rule.name}: ${state.toLowerCase()}`, res.rule?.lastNote ?? undefined)
      await rules.reload()
    } catch (err) {
      toast.error('Check failed', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setBusyId(null)
    }
  }

  async function toggle(rule: Rule) {
    try {
      await api(`/api/failover/${rule.id}`, { method: 'PATCH', body: { enabled: !rule.enabled } })
      await rules.reload()
    } catch (err) {
      toast.error('Update failed', err instanceof ApiClientError ? err.message : undefined)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api(`/api/failover/${deleteTarget.id}`, { method: 'DELETE' })
      toast.success('Rule deleted')
      setDeleteTarget(null)
      await rules.reload()
    } catch (err) {
      toast.error('Delete failed', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={t('failover.title')}
        subtitle="Real endpoint probes drive rule state. The panel reports status — it does not reroute live traffic."
        actions={
          canWrite ? (
            <Button size="sm" onClick={openCreate}>
              <Plus size={15} /> New rule
            </Button>
          ) : undefined
        }
      />

      {rules.loading && !rules.data ? (
        <LoadingBlock />
      ) : !rules.data || rules.data.items.length === 0 ? (
        <Card>
          <EmptyState
            title="No failover rules"
            description="Create a rule with a primary and a backup endpoint, then run checks to evaluate health."
            icon={<Shuffle size={24} />}
            action={
              canWrite ? (
                <Button onClick={openCreate}>
                  <Plus size={15} /> New rule
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {rules.data.items.map((rule, i) => (
            <Reveal key={rule.id} delay={Math.min(i * 0.05, 0.3)}>
              <Card className="p-5" hover>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-ink">{rule.name}</h3>
                    <p className="text-[11px] text-ink-soft">
                      every {rule.checkIntervalSec}s · fail ×{rule.failureThreshold} · recover ×{rule.recoveryThreshold}
                    </p>
                  </div>
                  <StatusBadge state={rule.state as SemanticState} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-surface p-3">
                    <p className="text-[10px] uppercase tracking-wider text-ink-soft">Primary</p>
                    <p className="mt-1 truncate text-xs font-medium text-ink">
                      {rule.primaryEndpoint ? `${rule.primaryEndpoint.name} (${rule.primaryEndpoint.address}:${rule.primaryEndpoint.port})` : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-surface p-3">
                    <p className="text-[10px] uppercase tracking-wider text-ink-soft">Backup</p>
                    <p className="mt-1 truncate text-xs font-medium text-ink">
                      {rule.backupEndpoint ? `${rule.backupEndpoint.name} (${rule.backupEndpoint.address}:${rule.backupEndpoint.port})` : '—'}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-xs text-ink-soft">
                  {rule.lastNote ?? 'Not checked yet — run a check to evaluate.'}{' '}
                  {rule.lastCheckedAt && `· ${timeAgo(rule.lastCheckedAt)}`}
                </p>

                {canWrite && (
                  <div className="mt-4 flex items-center gap-1.5 border-t border-hairline pt-3.5">
                    <Button variant="secondary" size="sm" onClick={() => checkNow(rule)} loading={busyId === rule.id}>
                      <RefreshCw size={13} /> Check now
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggle(rule)}>
                      {rule.enabled ? t('common.disable') : t('common.enable')}
                    </Button>
                    <div className="flex-1" />
                    <Button variant="ghost" size="sm" className="text-danger hover:bg-[rgba(220,38,38,0.07)]" onClick={() => setDeleteTarget(rule)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )}
              </Card>
            </Reveal>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New failover rule"
        description="The state machine is driven by real endpoint health checks."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={save} loading={saving} disabled={!form.name || !form.primaryEndpointId || !form.backupEndpointId}>
              {t('common.create')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Rule name" htmlFor="fo-name">
            <Input id="fo-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="eu-primary → us-backup" required />
          </Field>
          <Field label="Primary endpoint" htmlFor="fo-primary">
            <Select id="fo-primary" value={form.primaryEndpointId} onChange={(e) => setForm({ ...form, primaryEndpointId: e.target.value })} required>
              <option value="">— Select —</option>
              {(endpoints.data?.items ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.address}:{e.port})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Backup endpoint" htmlFor="fo-backup">
            <Select id="fo-backup" value={form.backupEndpointId} onChange={(e) => setForm({ ...form, backupEndpointId: e.target.value })} required>
              <option value="">— Select —</option>
              {(endpoints.data?.items ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.address}:{e.port})
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Interval (s)" htmlFor="fo-interval">
              <Input id="fo-interval" type="number" min="30" max="86400" value={form.checkIntervalSec} onChange={(e) => setForm({ ...form, checkIntervalSec: e.target.value })} />
            </Field>
            <Field label="Fail ×" htmlFor="fo-fail">
              <Input id="fo-fail" type="number" min="1" max="100" value={form.failureThreshold} onChange={(e) => setForm({ ...form, failureThreshold: e.target.value })} />
            </Field>
            <Field label="Recover ×" htmlFor="fo-recover">
              <Input id="fo-recover" type="number" min="1" max="100" value={form.recoveryThreshold} onChange={(e) => setForm({ ...form, recoveryThreshold: e.target.value })} />
            </Field>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={`Delete rule "${deleteTarget?.name ?? ''}"?`}
        description="The failover configuration will be removed."
        loading={deleting}
      />
    </div>
  )
}
