'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Eye, EyeOff, Lock, UserRound } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { api, ApiClientError } from '@/lib/api-client'
import { Logo } from '@/components/logo'
import { Button, Field, Input } from '@/components/ui-primitives'
import { useToast } from '@/components/toast'
import { springSoft } from '@/components/reveal'

export default function LoginPage() {
  const router = useRouter()
  const toast = useToast()
  const reduced = useReducedMotion()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setLoading(true)
    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: { identifier: identifier.trim(), password, remember },
      })
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Login failed.'
      setFormError(message)
      toast.error('Login failed', message)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Brand panel */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-navy-900 p-12 lg:flex">
        <div className="pixel-grid absolute inset-0 opacity-70" aria-hidden />
        <div
          className="absolute -end-32 -top-32 h-96 w-96 rounded-full opacity-25"
          style={{ background: 'radial-gradient(circle, #2563c9 0%, transparent 65%)' }}
          aria-hidden
        />
        <motion.div
          initial={reduced ? undefined : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
          className="relative"
        >
          <Logo size={44} withWordmark tone="light" />
        </motion.div>

        <motion.div
          initial={reduced ? undefined : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.12, ease: [0.22, 0.61, 0.36, 1] }}
          className="relative"
        >
          <h1 className="max-w-md text-3xl font-semibold leading-tight tracking-tight text-white">
            Every pixel of your infrastructure, one ping away.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/60">
            Manage users, servers, endpoints, traffic and Cloudflare — with real monitoring,
            real health checks and zero fake numbers.
          </p>
          <div className="mt-8 flex items-center gap-6">
            <div className="flex items-center gap-2 text-xs text-white/50">
              <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                <span className="ping-ring absolute inset-0 rounded-full" />
                <span className="h-2 w-2 rounded-full bg-brand-light" />
              </span>
              Live health monitoring
            </div>
            <div className="flex items-center gap-2 text-xs text-white/50">
              <span className="h-2 w-2 rounded-full bg-teal" />
              PostgreSQL-backed
            </div>
          </div>
        </motion.div>

        <p className="relative text-[11px] uppercase tracking-[0.2em] text-white/30">Pixel &amp; Ping 2.0 — Production</p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <motion.div
          initial={reduced ? undefined : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springSoft, delay: 0.08 }}
          className="w-full max-w-[400px]"
        >
          <div className="mb-8 lg:hidden">
            <Logo size={40} withWordmark />
          </div>

          <h2 className="text-xl font-semibold tracking-tight text-ink">Sign in to the panel</h2>
          <p className="mt-1.5 text-sm text-ink-soft">Use your panel account credentials.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
            <Field label="Email or username" htmlFor="identifier">
              <div className="relative">
                <UserRound size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                <Input
                  id="identifier"
                  name="identifier"
                  autoComplete="username"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="ps-9"
                  placeholder="admin@example.com"
                />
              </div>
            </Field>

            <Field label="Password" htmlFor="password">
              <div className="relative">
                <Lock size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="px-9"
                  placeholder="••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-soft hover:text-ink"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>

            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-ghost accent-[var(--brand)]"
              />
              Remember this session
            </label>

            {formError && (
              <div role="alert" className="rounded-xl border border-[rgba(220,38,38,0.2)] bg-[rgba(220,38,38,0.05)] px-3.5 py-2.5 text-sm text-danger">
                {formError}
              </div>
            )}

            <Button type="submit" size="lg" loading={loading} className="w-full">
              Sign in
              <ArrowRight size={16} />
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-ink-soft">
            First time here?{' '}
            <Link href="/setup" className="font-medium text-brand hover:underline">
              Create the first admin account
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
