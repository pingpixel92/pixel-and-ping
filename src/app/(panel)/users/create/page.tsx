'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { api, ApiClientError } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/components/toast'
import { Button, Card, Field, Input, PageHeader, Select, Textarea, Toggle } from '@/components/ui-primitives'

interface ServerOption {
  id: string
  name: string
}
interface EndpointOption {
  id: string
  name: string
  address: string
  port: number
}
interface PortOption {
  id: string
  number: number
  protocol: string
}

const PROTOCOLS = ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS', 'HTTPS', 'HTTP', 'TCP']

export default function CreateUserPage() {
  const router = useRouter()
  const toast = useToast()
  const { t } = useI18n()

  const [servers, setServers] = useState<ServerOption[]>([])
  const [endpoints, setEndpoints] = useState<EndpointOption[]>([])
  const [ports, setPorts] = useState<PortOption[]>([])
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    username: '',
    displayName: '',
    email: '',
    protocol: 'VLESS',
    serverId: '',
    endpointId: '',
    portId: '',
    unlimitedExpiry: true,
    expiresAt: '',
    unlimitedTraffic: true,
    trafficLimitGb: '',
    notes: '',
  })

  useEffect(() => {
    Promise.all([
      api<ListResponse<{ id: string; name: string }>>('/api/servers?pageSize=100'),
      api<ListResponse<EndpointOption>>('/api/endpoints?pageSize=100'),
      api<ListResponse<PortOption>>('/api/ports?pageSize=100'),
    ])
      .then(([s, e, p]) => {
        setServers(s.items)
        setEndpoints(e.items)
        setPorts(p.items)
      })
      .catch(() => toast.error('Load failed', 'Could not load servers/endpoints/ports.'))
  }, [toast])

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setSaving(true)
    try {
      const res = await api<{ id: string; warning: string | null }>('/api/users', {
        method: 'POST',
        body: {
          username: form.username.trim(),
          displayName: form.displayName,
          email: form.email,
          protocol: form.protocol,
          serverId: form.serverId,
          endpointId: form.endpointId,
          portId: form.portId,
          unlimitedExpiry: form.unlimitedExpiry,
          expiresAt: !form.unlimitedExpiry && form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
          unlimitedTraffic: form.unlimitedTraffic,
          trafficLimitGb: !form.unlimitedTraffic && form.trafficLimitGb ? Number(form.trafficLimitGb) : null,
          notes: form.notes,
        },
      })
      if (res.warning) {
        toast.warning('User created with a warning', res.warning)
      } else {
        toast.success('User created', `Configuration was generated for "${form.username}".`)
      }
      router.push(`/users/${res.id}`)
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'VALIDATION_ERROR') {
          const m = err.message
          const field = m.startsWith('username') ? 'username' : m.startsWith('email') ? 'email' : 'form'
          setFieldErrors({ [field]: m.includes(': ') ? m.split(': ').slice(1).join(': ') : m })
        } else {
          toast.error('Create failed', err.message)
        }
      } else {
        toast.error('Create failed')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title={t('users.createTitle')} subtitle="The backend validates every field and generates a real configuration." />

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 lg:grid-cols-3" noValidate>
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-ink">Profile</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('users.username')} htmlFor="username" hint="3–32 chars: letters, digits, . _ -" error={fieldErrors.username}>
              <Input
                id="username"
                required
                value={form.username}
                onChange={(e) => set('username', e.target.value)}
                placeholder="alice"
                pattern="[a-zA-Z0-9._\-]{3,32}"
              />
            </Field>
            <Field label={t('users.displayName')} htmlFor="displayName">
              <Input id="displayName" value={form.displayName} onChange={(e) => set('displayName', e.target.value)} placeholder="Alice Cooper" />
            </Field>
            <Field label={t('users.email')} htmlFor="email" error={fieldErrors.email} className="sm:col-span-2">
              <Input id="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="alice@example.com" />
            </Field>
            <Field label={t('users.notes')} htmlFor="notes" className="sm:col-span-2">
              <Textarea id="notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional internal notes…" />
            </Field>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-ink">Connection</h2>
            <div className="space-y-4">
              <Field label={t('users.protocol')} htmlFor="protocol" hint="VLESS/VMess/Trojan/SS generate real configs; others are transport targets.">
                <Select id="protocol" value={form.protocol} onChange={(e) => set('protocol', e.target.value)}>
                  {PROTOCOLS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('users.endpoint')} htmlFor="endpointId" hint="Takes precedence over server/port when set.">
                <Select id="endpointId" value={form.endpointId} onChange={(e) => set('endpointId', e.target.value)}>
                  <option value="">— None —</option>
                  {endpoints.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.address}:{e.port})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('users.server')} htmlFor="serverId">
                <Select id="serverId" value={form.serverId} onChange={(e) => set('serverId', e.target.value)}>
                  <option value="">— None —</option>
                  {servers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={`${t('users.port')} (fallback)`} htmlFor="portId">
                <Select id="portId" value={form.portId} onChange={(e) => set('portId', e.target.value)}>
                  <option value="">— None —</option>
                  {ports.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.number}/{p.protocol}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-ink">Limits</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-ink">{t('users.expires')} — {t('users.unlimited')}</span>
                <Toggle checked={form.unlimitedExpiry} onChange={(v) => set('unlimitedExpiry', v)} label="Unlimited expiry" />
              </div>
              {!form.unlimitedExpiry && (
                <Field label={t('users.expiryDate')} htmlFor="expiresAt">
                  <Input
                    id="expiresAt"
                    type="datetime-local"
                    value={form.expiresAt}
                    onChange={(e) => set('expiresAt', e.target.value)}
                  />
                </Field>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-ink">{t('users.traffic')} — {t('users.unlimited')}</span>
                <Toggle checked={form.unlimitedTraffic} onChange={(v) => set('unlimitedTraffic', v)} label="Unlimited traffic" />
              </div>
              {!form.unlimitedTraffic && (
                <Field label={t('users.trafficLimit')} htmlFor="trafficLimitGb">
                  <Input
                    id="trafficLimitGb"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={form.trafficLimitGb}
                    onChange={(e) => set('trafficLimitGb', e.target.value)}
                    placeholder="100"
                  />
                </Field>
              )}
            </div>
          </Card>

          <Button type="submit" size="lg" loading={saving} className="w-full">
            {t('common.create')}
          </Button>
        </div>
      </form>
    </div>
  )
}
