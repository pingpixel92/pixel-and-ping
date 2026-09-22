'use client'

import { ArrowRight, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { api, ApiClientError } from '@/lib/api-client'
import { Logo } from '@/components/logo'
import { Button, Field, Input } from '@/components/ui-primitives'
import { useToast } from '@/components/toast'

type SetupState = 'checking' | 'available' | 'token-required' | 'unavailable'

/**
 * One-time first-admin bootstrap.
 * Open when the database has no users; afterwards requires SETUP_TOKEN.
 */
export default function SetupPage() {
  const router = useRouter()
  const toast = useToast()
  const [state, setState] = useState<SetupState>('checking')
  const [form, setForm] = useState({ displayName: '', email: '', username: '', password: '', setupToken: '' })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    api<{ available: boolean; tokenRequired: boolean }>('/api/setup')
      .then((data) => {
        if (data.available) setState('available')
        else if (data.tokenRequired) setState('token-required')
        else setState('unavailable')
      })
      .catch(() => setState('unavailable'))
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setLoading(true)
    try {
      const res = await api<{
        user?: { id: string }
        conflict?: boolean
        forbidden?: boolean
        rateLimited?: boolean
      }>('/api/setup', { method: 'POST', body: form })

      if (res.user) {
        toast.success('Admin account created', 'Welcome to Pixel & Ping.')
        router.push('/dashboard')
        router.refresh()
        return
      }
      if (res.forbidden || res.rateLimited) {
        setErrors({ setupToken: 'Invalid setup token or rate limit reached.' })
      } else if (res.conflict) {
        setErrors({ username: 'Email or username already exists.' })
      }
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Setup failed.'
      toast.error('Setup failed', message)
      if (message.includes('username')) setErrors({ username: message.split(': ')[1] ?? message })
      if (message.includes('password')) setErrors({ password: message.split(': ')[1] ?? message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-6 py-12">
      <div className="w-full max-w-[440px]">
        <div className="mb-6 flex justify-center">
          <Logo size={40} withWordmark />
        </div>

        <div className="card p-7">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-900 text-brand-light">
              <ShieldCheck size={19} />
            </span>
            <div>
              <h1 className="text-base font-semibold text-ink">First-time setup</h1>
              <p className="text-xs text-ink-soft">Create the initial administrator account.</p>
            </div>
          </div>

          {state === 'checking' && <p className="py-6 text-center text-sm text-ink-soft">Checking system state…</p>}

          {state === 'unavailable' && (
            <div className="space-y-4 text-sm text-ink-soft">
              <p>Setup is not available. The panel already has an administrator account.</p>
              <Link href="/login" className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline">
                Go to sign in <ArrowRight size={14} />
              </Link>
            </div>
          )}

          {(state === 'available' || state === 'token-required') && (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              {state === 'token-required' && (
                <Field label="Setup token" htmlFor="setupToken" hint="Provided via the SETUP_TOKEN environment variable." error={errors.setupToken}>
                  <Input
                    id="setupToken"
                    value={form.setupToken}
                    onChange={(e) => setForm({ ...form, setupToken: e.target.value })}
                    placeholder="One-time token"
                    required
                  />
                </Field>
              )}
              <Field label="Your name" htmlFor="displayName" error={errors.displayName}>
                <Input
                  id="displayName"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder="Admin"
                  required
                  minLength={2}
                />
              </Field>
              <Field label="Email" htmlFor="email" error={errors.email}>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="admin@example.com"
                  required
                />
              </Field>
              <Field label="Username" htmlFor="username" hint="3–32 chars: letters, digits, . _ -" error={errors.username}>
                <Input
                  id="username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="admin"
                  required
                />
              </Field>
              <Field
                label="Password"
                htmlFor="password"
                hint="Min 10 chars with a lowercase letter and an uppercase letter or digit."
                error={errors.password}
              >
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••••"
                  required
                  minLength={10}
                />
              </Field>
              <Button type="submit" size="lg" loading={loading} className="w-full">
                Create admin &amp; sign in
              </Button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-ink-soft">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
