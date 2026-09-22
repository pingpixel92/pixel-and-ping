'use client'

import { useState } from 'react'
import { FileCode2, Trash2, Wand2 } from 'lucide-react'
import { api, ApiClientError, type ListResponse } from '@/lib/api-client'
import { formatDateTime } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { useApi } from '@/lib/hooks'
import { ConfirmDialog } from '@/components/modal'
import { useToast } from '@/components/toast'
import { Reveal } from '@/components/reveal'
import {
  Badge, Button, Card, CopyButton, EmptyState, Field, Input, LoadingBlock, PageHeader, Select, Toggle,
} from '@/components/ui-primitives'
import { useMe } from '@/components/shell/auth-gate'

interface ProviderInfo {
  id: string
  label: string
  implemented: boolean
}

interface SavedConfig {
  id: string
  name: string
  protocol: string
  content: string
  vpnUser: string | null
  createdAt: string
}

const PROTOCOLS = ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS', 'HTTPS', 'HTTP', 'TCP']

export default function ConfigsPage() {
  const { t } = useI18n()
  const toast = useToast()
  const { user } = useMe()
  const canWrite = user?.role === 'ADMIN' || user?.role === 'OPERATOR'

  const providers = useApi<{ providers: ProviderInfo[] }>('/api/configs/providers')
  const [page, setPage] = useState(1)
  const saved = useApi<ListResponse<SavedConfig>>(`/api/configs?page=${page}&pageSize=8`)

  const [form, setForm] = useState({ displayName: '', protocol: 'VLESS', host: '', port: '443', tls: true, sni: '', save: true })
  const [result, setResult] = useState<{ content: string | null; protocol: string; providerImplemented: boolean } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SavedConfig | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function generate(e: React.FormEvent) {
    e.preventDefault()
    setGenerating(true)
    try {
      const res = await api<{ content: string | null; protocol: string; providerImplemented: boolean; message?: string }>('/api/configs', {
        method: 'POST',
        body: { ...form, port: Number(form.port) },
      })
      setResult(res)
      if (!res.providerImplemented) {
        toast.warning(t('configs.providerNotConfigured'), res.message ?? `${res.protocol} has no provider implementation.`)
      } else {
        toast.success('Configuration generated', `${res.protocol} config built with fresh credentials.`)
        if (form.save) void saved.reload()
      }
    } catch (err) {
      toast.error('Generation failed', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setGenerating(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api(`/api/configs/${deleteTarget.id}`, { method: 'DELETE' })
      toast.success('Config deleted')
      setDeleteTarget(null)
      await saved.reload()
    } catch (err) {
      toast.error('Delete failed', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={t('configs.title')}
        subtitle="Real configuration builders — credentials are generated fresh every time."
      />

      {/* Provider capability matrix — honest about what exists */}
      {providers.data && (
        <Reveal>
          <div className="mb-6 flex flex-wrap gap-2">
            {providers.data.providers.map((p) => (
              <span key={p.id} title={p.label}>
                <Badge tone={p.implemented ? 'brand' : 'neutral'}>
                  {p.id}
                  {p.implemented ? ' ✓' : ' —'}
                </Badge>
              </span>
            ))}
            <span className="text-[11px] text-ink-soft">✓ implemented · — {t('configs.providerNotConfigured')}</span>
          </div>
        </Reveal>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Reveal className="lg:col-span-2">
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-ink">Generator</h2>
            {canWrite ? (
              <form onSubmit={generate} className="space-y-4">
                <Field label="Label" htmlFor="cfg-label">
                  <Input id="cfg-label" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="my-phone" required />
                </Field>
                <Field label={t('users.protocol')} htmlFor="cfg-protocol">
                  <Select id="cfg-protocol" value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value })}>
                    {PROTOCOLS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Host" htmlFor="cfg-host" className="col-span-2">
                    <Input id="cfg-host" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="1.2.3.4" required />
                  </Field>
                  <Field label="Port" htmlFor="cfg-port">
                    <Input id="cfg-port" type="number" min="1" max="65535" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} required />
                  </Field>
                </div>
                <Field label="SNI (optional)" htmlFor="cfg-sni">
                  <Input id="cfg-sni" value={form.sni} onChange={(e) => setForm({ ...form, sni: e.target.value })} placeholder="cdn.example.com" />
                </Field>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2.5 text-sm text-ink">
                    <Toggle checked={form.tls} onChange={(v) => setForm({ ...form, tls: v })} label="TLS" />
                    TLS
                  </label>
                  <label className="flex items-center gap-2.5 text-sm text-ink">
                    <Toggle checked={form.save} onChange={(v) => setForm({ ...form, save: v })} label="Save to library" />
                    Save to library
                  </label>
                </div>
                <Button type="submit" loading={generating} className="w-full">
                  <Wand2 size={15} /> {t('configs.generate')}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-ink-soft">Your role has read-only access to configurations.</p>
            )}
          </Card>
        </Reveal>

        <Reveal className="lg:col-span-3" delay={0.06}>
          <Card className="flex min-h-[320px] flex-col p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Output</h2>
              {result?.content && <CopyButton text={result.content} />}
            </div>
            {!result ? (
              <div className="flex flex-1 items-center justify-center rounded-xl bg-surface text-sm text-ink-soft">
                Generated configurations appear here.
              </div>
            ) : !result.providerImplemented ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl bg-surface text-center">
                <p className="text-sm font-medium text-ink">{t('configs.providerNotConfigured')}</p>
                <p className="max-w-xs text-xs text-ink-soft">
                  {result.protocol} is a transport target in this panel — only VLESS, VMess, Trojan and Shadowsocks builders are implemented.
                </p>
              </div>
            ) : (
              <pre className="mono max-h-72 flex-1 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-navy-900 p-4 text-[11px] leading-relaxed text-brand-light">
                {result.content}
              </pre>
            )}
          </Card>
        </Reveal>
      </div>

      {/* Saved library */}
      <Reveal className="mt-6" delay={0.1}>
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
            <FileCode2 size={15} className="text-brand" /> Saved configurations
          </h2>
          {saved.loading && !saved.data ? (
            <LoadingBlock />
          ) : !saved.data || saved.data.items.length === 0 ? (
            <EmptyState title="No saved configs" description="Generated configurations saved to the library will be listed here." />
          ) : (
            <ul className="divide-y divide-hairline">
              {saved.data.items.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{c.name}</p>
                    <p className="text-[11px] text-ink-soft">
                      {c.protocol} · {c.vpnUser ? `user: ${c.vpnUser}` : 'ad-hoc'} · {formatDateTime(c.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CopyButton text={c.content} label={t('common.copy')} />
                    <Button variant="ghost" size="sm" className="text-danger hover:bg-[rgba(220,38,38,0.07)]" onClick={() => setDeleteTarget(c)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {saved.data && saved.data.total > saved.data.pageSize && (
            <div className="mt-4 flex items-center justify-between text-xs text-ink-soft">
              <span>
                Page {saved.data.page} / {Math.ceil(saved.data.total / saved.data.pageSize)}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Prev
                </Button>
                <Button variant="secondary" size="sm" disabled={page >= Math.ceil(saved.data.total / saved.data.pageSize)} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </Reveal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={`Delete "${deleteTarget?.name ?? ''}"?`}
        description="The saved configuration will be removed from the library."
        loading={deleting}
      />
    </div>
  )
}
