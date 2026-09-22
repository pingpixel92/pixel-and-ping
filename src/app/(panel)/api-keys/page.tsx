'use client'

import { useState } from 'react'
import { KeyRound, Plus } from 'lucide-react'
import { api, ApiClientError } from '@/lib/api-client'
import { formatDateTime, timeAgo } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { useApi } from '@/lib/hooks'
import { ConfirmDialog, Modal } from '@/components/modal'
import { useToast } from '@/components/toast'
import { Reveal } from '@/components/reveal'
import {
  Badge, Button, Card, CopyButton, EmptyState, Field, Input, LoadingBlock, MonoValue, PageHeader, Select,
} from '@/components/ui-primitives'
import { useMe } from '@/components/shell/auth-gate'

interface ApiKeyRow {
  id: string
  name: string
  prefix: string
  permissions: string[]
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  createdBy: string | null
  createdAt: string
}

export default function ApiKeysPage() {
  const { t } = useI18n()
  const toast = useToast()
  const { user } = useMe()
  const canManage = user?.role === 'ADMIN'

  const [includeRevoked, setIncludeRevoked] = useState(true)
  const { data, loading, error, reload } = useApi<{ items: ApiKeyRow[] }>(
    `/api/api-keys${includeRevoked ? '?includeRevoked=1' : ''}`,
  )

  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [expiresInDays, setExpiresInDays] = useState('')
  const [permission, setPermission] = useState<'traffic:ingest'>('traffic:ingest')
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<{ key: string; name: string } | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null)
  const [revoking, setRevoking] = useState(false)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await api<{ id: string; key: string; name: string }>('/api/api-keys', {
        method: 'POST',
        body: {
          name,
          permissions: [permission],
          expiresInDays: expiresInDays ? Number(expiresInDays) : null,
        },
      })
      setCreated({ key: res.key, name: res.name })
      setModalOpen(false)
      setName('')
      setExpiresInDays('')
      await reload()
    } catch (err) {
      toast.error('Creation failed', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setCreating(false)
    }
  }

  async function revoke() {
    if (!revokeTarget) return
    setRevoking(true)
    try {
      await api(`/api/api-keys/${revokeTarget.id}`, { method: 'DELETE' })
      toast.success('Key revoked', `"${revokeTarget.name}" can no longer authenticate.`)
      setRevokeTarget(null)
      await reload()
    } catch (err) {
      toast.error('Revoke failed', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setRevoking(false)
    }
  }

  if (!canManage) {
    return (
      <div>
        <PageHeader title={t('apiKeys.title')} />
        <Card>
          <EmptyState title="Admin only" description="API key management is restricted to administrators." icon={<KeyRound size={24} />} />
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={t('apiKeys.title')}
        subtitle="Secrets are stored as SHA-256 hashes and shown exactly once at creation."
        actions={
          <>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
              <input type="checkbox" checked={includeRevoked} onChange={(e) => setIncludeRevoked(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--brand)]" />
              Show revoked
            </label>
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus size={15} /> Create key
            </Button>
          </>
        }
      />

      {/* One-time secret display */}
      {created && (
        <Reveal>
          <Card className="mb-4 border-[rgba(37,99,201,0.35)] bg-[rgba(37,99,201,0.04)] p-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-ink">Copy your key now — “{created.name}”</h2>
              <CopyButton text={created.key} label="Copy key" size="md" />
            </div>
            <pre className="mono overflow-x-auto rounded-xl bg-navy-900 p-3.5 text-xs text-brand-light">{created.key}</pre>
            <p className="mt-2 text-xs text-ink-soft">
              This is the only time the full key is visible. Only its SHA-256 hash is stored.
            </p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => setCreated(null)}>
              I saved it
            </Button>
          </Card>
        </Reveal>
      )}

      {loading && !data ? (
        <LoadingBlock />
      ) : error ? (
        <Card className="p-10 text-center text-sm text-danger">{error.message}</Card>
      ) : !data || data.items.length === 0 ? (
        <Card>
          <EmptyState
            title="No API keys"
            description="Create a key to allow external exporters to push real traffic data."
            icon={<KeyRound size={24} />}
            action={
              <Button onClick={() => setModalOpen(true)}>
                <Plus size={15} /> Create key
              </Button>
            }
          />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-hairline">
            {data.items.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink">{k.name}</p>
                    <MonoValue>{k.prefix}…</MonoValue>
                    {k.permissions.map((p) => (
                      <Badge key={p} tone="brand">
                        {p}
                      </Badge>
                    ))}
                    {k.revokedAt && <Badge tone="neutral">revoked {formatDateTime(k.revokedAt)}</Badge>}
                  </div>
                  <p className="mt-1 text-[11px] text-ink-soft">
                    created {formatDateTime(k.createdAt)} by {k.createdBy ?? '—'} · last used {k.lastUsedAt ? timeAgo(k.lastUsedAt) : 'never'}
                    {k.expiresAt ? ` · expires ${formatDateTime(k.expiresAt)}` : ''}
                  </p>
                </div>
                {!k.revokedAt && (
                  <Button variant="ghost" size="sm" className="text-danger hover:bg-[rgba(220,38,38,0.07)]" onClick={() => setRevokeTarget(k)}>
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create API key"
        description="The full secret is displayed once after creation."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={creating}>
              {t('common.cancel')}
            </Button>
            <Button onClick={create} loading={creating} disabled={name.length < 2}>
              Create key
            </Button>
          </>
        }
      >
        <form onSubmit={create} className="space-y-4">
          <Field label="Key name" htmlFor="key-name">
            <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="xray-exporter" required minLength={2} />
          </Field>
          <Field label="Permission" htmlFor="key-perm">
            <Select id="key-perm" value={permission} onChange={(e) => setPermission(e.target.value as 'traffic:ingest')}>
              <option value="traffic:ingest">traffic:ingest — push traffic records</option>
            </Select>
          </Field>
          <Field label="Expires in days (optional)" htmlFor="key-exp">
            <Input id="key-exp" type="number" min="1" max="3650" value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} placeholder="365" />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={revoke}
        title={`Revoke "${revokeTarget?.name ?? ''}"?`}
        description="Requests using this key will be rejected immediately."
        confirmLabel="Revoke key"
        loading={revoking}
      />
    </div>
  )
}
