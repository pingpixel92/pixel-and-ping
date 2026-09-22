'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Cloud, KeyRound, Palette, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react'
import { api, ApiClientError } from '@/lib/api-client'
import { formatDateTime } from '@/lib/format'
import { useI18n, LOCALES, type Locale } from '@/lib/i18n'
import { useApi } from '@/lib/hooks'
import { ConfirmDialog } from '@/components/modal'
import { useToast } from '@/components/toast'
import { Reveal } from '@/components/reveal'
import { useMe } from '@/components/shell/auth-gate'
import {
  Button, Card, Field, Input, LoadingBlock, PageHeader, Select, StatusBadge, Tabs, Toggle,
} from '@/components/ui-primitives'

interface PanelSettings {
  healthCheckIntervalMin: number
  sessionTimeoutMin: number
  expiryAlertDays: number
  notify: { expiry: boolean; health: boolean; integration: boolean }
  appearance: { accent: string; density: string }
}

const TABS = [
  { id: 'account', label: 'Account' },
  { id: 'security', label: 'Security' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'system', label: 'System' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'danger', label: 'Danger Zone' },
]

export default function SettingsPage() {
  const { t, locale, setLocale } = useI18n()
  const toast = useToast()
  const { user, refresh: refreshMe } = useMe()
  const canManage = user?.role === 'ADMIN'
  const settings = useApi<PanelSettings>('/api/settings')
  const [tab, setTab] = useState('account')

  // Account state
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [savingAccount, setSavingAccount] = useState(false)

  // Security state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  // Danger zone
  const [confirmPurge, setConfirmPurge] = useState<'traffic' | 'analytics' | null>(null)
  const [purging, setPurging] = useState(false)

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName)
      setEmail(user.email)
    }
  }, [user])

  async function saveAccount() {
    setSavingAccount(true)
    try {
      const res = await api<{ conflict?: string; user?: { displayName: string } }>('/api/me', {
        method: 'PATCH',
        body: { displayName, email },
      })
      if (res.conflict) {
        toast.error('Email already in use', 'Choose a different email address.')
      } else {
        toast.success('Account updated')
        await refreshMe()
      }
    } catch (err) {
      toast.error('Update failed', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setSavingAccount(false)
    }
  }

  async function changePassword() {
    setChangingPassword(true)
    try {
      await api('/api/auth/password', { method: 'POST', body: { currentPassword, newPassword } })
      toast.success('Password changed', 'All future sign-ins require the new password.')
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      toast.error('Change failed', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setChangingPassword(false)
    }
  }

  async function saveSettings(patch: Record<string, unknown>) {
    try {
      await api('/api/settings', { method: 'PUT', body: patch })
      toast.success('Settings saved')
      await settings.reload()
    } catch (err) {
      toast.error('Save failed', err instanceof ApiClientError ? err.message : undefined)
    }
  }

  async function purge(kind: 'traffic' | 'analytics') {
    // Implemented against real maintenance endpoints (admin only).
    setPurging(true)
    try {
      await api('/api/settings/purge', { method: 'POST', body: { target: kind } })
      toast.success(`${kind === 'traffic' ? 'Traffic' : 'Analytics'} records purged`)
      setConfirmPurge(null)
    } catch (err) {
      toast.error('Purge failed', err instanceof ApiClientError ? err.message : undefined)
    } finally {
      setPurging(false)
    }
  }

  if (settings.loading && !settings.data) return <LoadingBlock />
  const s = settings.data

  return (
    <div>
      <PageHeader title={t('settings.title')} subtitle="All changes persist to PostgreSQL immediately." />
      <div className="mb-6">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {/* ACCOUNT */}
      {tab === 'account' && (
        <Reveal>
          <Card className="max-w-xl p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
              <UserRound size={15} className="text-brand" /> Profile
            </h2>
            <div className="space-y-4">
              <Field label="Display name" htmlFor="set-name">
                <Input id="set-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </Field>
              <Field label="Email" htmlFor="set-email">
                <Input id="set-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Username" htmlFor="set-username" hint="Usernames are immutable.">
                <Input id="set-username" value={user?.username ?? ''} disabled />
              </Field>
              <Button onClick={saveAccount} loading={savingAccount}>
                {t('common.save')}
              </Button>
            </div>
          </Card>
        </Reveal>
      )}

      {/* SECURITY */}
      {tab === 'security' && (
        <div className="max-w-xl space-y-4">
          <Reveal>
            <Card className="p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
                <ShieldCheck size={15} className="text-brand" /> Password
              </h2>
              <div className="space-y-4">
                <Field label="Current password" htmlFor="cur-pass">
                  <Input id="cur-pass" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                </Field>
                <Field label="New password" htmlFor="new-pass" hint="Min 10 chars, lowercase + (uppercase or digit).">
                  <Input id="new-pass" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </Field>
                <Button onClick={changePassword} loading={changingPassword} disabled={!currentPassword || !newPassword}>
                  Change password
                </Button>
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.05}>
            <Card className="p-5">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                <KeyRound size={15} className="text-brand" /> Two-factor authentication
              </h2>
              <p className="text-sm text-ink-soft">
                <StatusBadge state="NOT_CONFIGURED" /> — TOTP enrolment is not active for your account. The schema and
                credential storage already provide encrypted secret fields, but the enrolment flow is not enabled in this
                build, so no 2FA state is claimed.
              </p>
            </Card>
          </Reveal>
        </div>
      )}

      {/* APPEARANCE */}
      {tab === 'appearance' && (
        <Reveal>
          <Card className="max-w-xl p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
              <Palette size={15} className="text-brand" /> Appearance & language
            </h2>
            <div className="space-y-4">
              <Field label="Language (default English)" htmlFor="set-locale" hint="Persian switches the panel to RTL.">
                <Select
                  id="set-locale"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as Locale)}
                >
                  {LOCALES.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Accent" htmlFor="set-accent" hint="Applied to new sessions.">
                <Select
                  id="set-accent"
                  value={s?.appearance.accent ?? 'blue'}
                  onChange={(e) => void saveSettings({ appearance: { accent: e.target.value } })}
                  disabled={!canManage}
                >
                  <option value="blue">Pixel Blue (#2563c9)</option>
                  <option value="navy">Deep Navy (#0f2f63)</option>
                </Select>
              </Field>
            </div>
          </Card>
        </Reveal>
      )}

      {/* NOTIFICATIONS */}
      {tab === 'notifications' && s && (
        <Reveal>
          <Card className="max-w-xl p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
              <SlidersHorizontal size={15} className="text-brand" /> Alert generation
            </h2>
            <div className="space-y-4">
              <SettingToggle
                label="Expiry alerts"
                hint={`Alert ${s.expiryAlertDays} days before managed users expire.`}
                checked={s.notify.expiry}
                disabled={!canManage}
                onChange={(v) => void saveSettings({ notify: { expiry: v } })}
              />
              <SettingToggle
                label="Health alerts"
                hint="Notify when servers and endpoints change status."
                checked={s.notify.health}
                disabled={!canManage}
                onChange={(v) => void saveSettings({ notify: { health: v } })}
              />
              <SettingToggle
                label="Integration alerts"
                hint="Cloudflare connection events."
                checked={s.notify.integration}
                disabled={!canManage}
                onChange={(v) => void saveSettings({ notify: { integration: v } })}
              />
              {canManage && (
                <div className="border-t border-hairline pt-4">
                  <Field
                    label="Expiry alert window (days)"
                    htmlFor="set-expiry-days"
                  >
                    <Input
                      id="set-expiry-days"
                      type="number"
                      min="1"
                      max="90"
                      defaultValue={s.expiryAlertDays}
                      onBlur={(e) => void saveSettings({ expiryAlertDays: Number(e.target.value) })}
                      className="w-32"
                    />
                  </Field>
                </div>
              )}
            </div>
          </Card>
        </Reveal>
      )}

      {/* SYSTEM */}
      {tab === 'system' && s && (
        <Reveal>
          <Card className="max-w-xl p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
              <SlidersHorizontal size={15} className="text-brand" /> Operational parameters
            </h2>
            <div className="space-y-4">
              <Field label="Health check interval (minutes)" htmlFor="set-hc" hint="Background jobs probe every server and endpoint at this cadence.">
                <Input
                  id="set-hc"
                  type="number"
                  min="1"
                  max="1440"
                  defaultValue={s.healthCheckIntervalMin}
                  onBlur={(e) => void saveSettings({ healthCheckIntervalMin: Number(e.target.value) })}
                  disabled={!canManage}
                  className="w-40"
                />
              </Field>
              <Field label="Session timeout (minutes)" htmlFor="set-session" hint="Applied to newly created sessions.">
                <Input
                  id="set-session"
                  type="number"
                  min="15"
                  max="43200"
                  defaultValue={s.sessionTimeoutMin}
                  onBlur={(e) => void saveSettings({ sessionTimeoutMin: Number(e.target.value) })}
                  disabled={!canManage}
                  className="w-40"
                />
              </Field>
              {!canManage && <p className="text-xs text-ink-soft">Only administrators can change system parameters.</p>}
            </div>
          </Card>
        </Reveal>
      )}

      {/* INTEGRATIONS */}
      {tab === 'integrations' && (
        <Reveal>
          <Card className="max-w-xl p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
              <Cloud size={15} className="text-brand" /> Cloudflare
            </h2>
            <p className="text-sm text-ink-soft">
              Manage the Cloudflare connection from its dedicated page — token verification, zones and DNS records.
            </p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => (window.location.href = '/cloudflare')}>
              Open Cloudflare settings
            </Button>
          </Card>
        </Reveal>
      )}

      {/* DANGER ZONE */}
      {tab === 'danger' && (
        <Reveal>
          <Card className="max-w-xl border-[rgba(220,38,38,0.25)] p-5">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-danger">
              <AlertTriangle size={15} /> Danger Zone
            </h2>
            <p className="mb-4 text-xs text-ink-soft">Administrators only. These operations permanently delete records.</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-surface p-4">
                <div>
                  <p className="text-sm font-medium text-ink">Purge traffic records</p>
                  <p className="text-xs text-ink-soft">Deletes all ingested TrafficRecords.</p>
                </div>
                <Button variant="danger" size="sm" disabled={!canManage} onClick={() => setConfirmPurge('traffic')}>
                  Purge
                </Button>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-surface p-4">
                <div>
                  <p className="text-sm font-medium text-ink">Purge analytics events</p>
                  <p className="text-xs text-ink-soft">Deletes all stored AnalyticsEvents.</p>
                </div>
                <Button variant="danger" size="sm" disabled={!canManage} onClick={() => setConfirmPurge('analytics')}>
                  Purge
                </Button>
              </div>
            </div>
          </Card>
        </Reveal>
      )}

      <ConfirmDialog
        open={confirmPurge !== null}
        onClose={() => setConfirmPurge(null)}
        onConfirm={() => confirmPurge && purge(confirmPurge)}
        title={confirmPurge === 'traffic' ? 'Purge all traffic records?' : 'Purge all analytics events?'}
        description="This permanently deletes the records. Charts will show no data until new records exist."
        confirmLabel="Purge"
        loading={purging}
      />
    </div>
  )
}

function SettingToggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-surface/70 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-ink-soft">{hint}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} label={label} />
    </div>
  )
}
