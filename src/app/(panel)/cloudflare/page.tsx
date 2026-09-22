'use client'

import { useState } from 'react'
import { Cloud, CloudOff, Globe, RefreshCw } from 'lucide-react'
import { api, ApiClientError } from '@/lib/api-client'
import { formatDateTime, timeAgo } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { useApi } from '@/lib/hooks'
import { ConfirmDialog } from '@/components/modal'
import { useToast } from '@/components/toast'
import { Reveal } from '@/components/reveal'
import {
  Badge, Button, Card, EmptyState, Field, Input, LoadingBlock, PageHeader, StatusBadge,
} from '@/components/ui-primitives'
import { useMe } from '@/components/shell/auth-gate'

interface CfStatus {
  connected: boolean
  name: string | null
  verified: boolean
  zoneCount: number
  lastVerifiedAt: string | null
  connectedAt: string | null
}

interface Zone {
  zoneId: string
  name: string
  status: string
}

interface DnsRecord {
  id: string
  type: string
  name: string
  content: string
  proxied: boolean | null
  ttl: number
}

export default function CloudflarePage() {
  const { t } = useI18n()
  const toast = useToast()
  const { user } = useMe()
  const canManage = user?.role === 'ADMIN'

  const status = useApi<CfStatus>('/api/cloudflare')
  const [token, setToken] = useState('')
  const [name, setName] = useState('Cloudflare')
  const [connecting, setConnecting] = useState(false)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [zones, setZones] = useState<Zone[] | null>(null)
  const [loadingZones, setLoadingZones] = useState(false)
  const [recordsFor, setRecordsFor] = useState<Zone | null>(null)
  const [records, setRecords] = useState<DnsRecord[] | null>(null)
  const [loadingRecords, setLoadingRecords] = useState(false)

  async function connect(e: React.FormEvent) {
    e.preventDefault()
    setConnecting(true)
    try {
      await api<CfStatus>('/api/cloudflare/connect', { method: 'POST', body: { token: token.trim(), name } })
      toast.success('Cloudflare connected', 'Token verified against the live Cloudflare API.')
      setToken('')
      await status.reload()
      setZones(null)
    } catch (err) {
      toast.error('Connection failed', err instanceof ApiClientError ? err.message : 'Check the token and try again.')
    } finally {
      setConnecting(false)
    }
  }

  async function disconnect() {
    setDisconnecting(true)
    try {
      await api('/api/cloudflare/disconnect', { method: 'DELETE' })
      toast.success('Cloudflare disconnected')
      setDisconnectOpen(false)
      setZones(null)
      setRecordsFor(null)
      setRecords(null)
      await status.reload()
    } catch (err) {
      toast.error('Disconnect failed', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setDisconnecting(false)
    }
  }

  async function fetchZones() {
    setLoadingZones(true)
    try {
      const res = await api<{ zones: Zone[] }>('/api/cloudflare/zones')
      setZones(res.zones)
      toast.success('Zones refreshed', `${res.zones.length} zone(s) from the Cloudflare API.`)
    } catch (err) {
      toast.error('Could not list zones', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setLoadingZones(false)
    }
  }

  async function openRecords(zone: Zone) {
    setRecordsFor(zone)
    setRecords(null)
    setLoadingRecords(true)
    try {
      const res = await api<{ records: DnsRecord[] }>(`/api/cloudflare/zones/${encodeURIComponent(zone.zoneId)}`)
      setRecords(res.records)
    } catch (err) {
      toast.error('Could not load DNS records', err instanceof ApiClientError ? err.message : undefined)
      setRecordsFor(null)
    } finally {
      setLoadingRecords(false)
    }
  }

  const s = status.data

  return (
    <div>
      <PageHeader
        title={t('nav.cloudflare')}
        subtitle="Token-based integration — credentials are AES-256-GCM encrypted and never displayed again."
      />

      {status.loading && !s ? (
        <LoadingBlock />
      ) : !canManage ? (
        <Card>
          <EmptyState title="Admin only" description="Cloudflare integration is managed by administrators. You have read-only visibility." />
        </Card>
      ) : !s?.connected ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <EmptyState
              title={t('empty.cloudflare.title')}
              description={t('empty.cloudflare.desc')}
              icon={<Cloud size={24} />}
            />
          </Card>
          <Reveal delay={0.05}>
            <Card className="p-5">
              <h2 className="mb-4 text-sm font-semibold text-ink">Connect account</h2>
              <form onSubmit={connect} className="space-y-4">
                <Field label="Account label" htmlFor="cf-name">
                  <Input id="cf-name" value={name} onChange={(e) => setName(e.target.value)} required />
                </Field>
                <Field
                  label="API token"
                  htmlFor="cf-token"
                  hint="Create a token with Zone:Read permission in the Cloudflare dashboard. It is stored encrypted and never shown again."
                >
                  <Input id="cf-token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="v1.0-abc…" required minLength={20} />
                </Field>
                <Button type="submit" loading={connecting} className="w-full">
                  <Cloud size={15} /> Verify &amp; connect
                </Button>
              </form>
            </Card>
          </Reveal>
        </div>
      ) : (
        <div className="space-y-4">
          <Reveal>
            <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-900 text-brand-light">
                  <Cloud size={22} />
                </span>
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                    {s.name}
                    <StatusBadge state={s.verified ? 'HEALTHY' : 'DEGRADED'} label={s.verified ? 'Verified' : 'Unverified'} />
                  </p>
                  <p className="text-xs text-ink-soft">
                    {s.zoneCount} cached zone(s) · connected {formatDateTime(s.connectedAt)}
                    {s.lastVerifiedAt && ` · token verified ${timeAgo(s.lastVerifiedAt)}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={fetchZones} loading={loadingZones}>
                  <RefreshCw size={14} /> {t('common.refresh')} zones
                </Button>
                <Button variant="danger" size="sm" onClick={() => setDisconnectOpen(true)}>
                  <CloudOff size={14} /> Disconnect
                </Button>
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.06}>
            <Card className="p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
                <Globe size={15} className="text-brand" /> Zones
              </h2>
              {!zones ? (
                <p className="text-sm text-ink-soft">Click “Refresh zones” to load live zones from the Cloudflare API.</p>
              ) : zones.length === 0 ? (
                <p className="text-sm text-ink-soft">No zones found for this token.</p>
              ) : (
                <ul className="divide-y divide-hairline">
                  {zones.map((z) => (
                    <li key={z.zoneId} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium text-ink">{z.name}</p>
                        <p className="text-[11px] text-ink-soft">{z.zoneId}</p>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Badge tone={z.status === 'active' ? 'brand' : 'neutral'}>{z.status}</Badge>
                        <Button variant="secondary" size="sm" onClick={() => openRecords(z)}>
                          DNS records
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Reveal>

          {recordsFor && (
            <Reveal>
              <Card className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-ink">DNS records — {recordsFor.name}</h2>
                  <Button variant="ghost" size="sm" onClick={() => setRecordsFor(null)}>
                    {t('common.close')}
                  </Button>
                </div>
                {loadingRecords ? (
                  <LoadingBlock />
                ) : records && records.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className="border-b border-hairline text-start text-xs text-ink-soft">
                          <th className="py-2 text-start font-medium">Type</th>
                          <th className="py-2 text-start font-medium">Name</th>
                          <th className="py-2 text-start font-medium">Content</th>
                          <th className="py-2 text-start font-medium">Proxy</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((r) => (
                          <tr key={r.id} className="border-b border-hairline last:border-0">
                            <td className="py-2.5"><Badge tone="neutral">{r.type}</Badge></td>
                            <td className="py-2.5 text-xs">{r.name}</td>
                            <td className="mono max-w-[240px] truncate py-2.5 text-xs" title={r.content}>{r.content}</td>
                            <td className="py-2.5 text-xs text-ink-soft">{r.proxied ? 'proxied' : 'DNS only'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="py-4 text-sm text-ink-soft">No DNS records found for this zone.</p>
                )}
              </Card>
            </Reveal>
          )}
        </div>
      )}

      <ConfirmDialog
        open={disconnectOpen}
        onClose={() => setDisconnectOpen(false)}
        onConfirm={disconnect}
        title="Disconnect Cloudflare?"
        description="The encrypted token and cached zones will be deleted from the database."
        confirmLabel="Disconnect"
        loading={disconnecting}
      />
    </div>
  )
}
