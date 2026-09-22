'use client'

import { forwardRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Check, Copy, Loader2 } from 'lucide-react'
import { springSoft } from './reveal'

// ───────────────────────── Button ─────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'navy'
type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brand-deep shadow-[0_1px_2px_rgba(10,26,54,0.18)]',
  navy: 'bg-navy-900 text-white hover:bg-navy-800',
  secondary: 'bg-surface-card text-ink border border-hairline hover:border-ghost hover:bg-surface',
  ghost: 'bg-transparent text-ink-soft hover:text-ink hover:bg-surface',
  danger: 'bg-danger text-white hover:brightness-110',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9.5 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className = '', children, disabled, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.97 }}
      transition={springSoft}
      className={`inline-flex select-none items-center justify-center rounded-[10px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      disabled={disabled || loading}
      {...(rest as object)}
    >
      {loading && <Loader2 size={14} className="animate-spin" aria-hidden />}
      {children}
    </motion.button>
  )
})

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  active?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, active, className = '', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-ink-soft transition-colors hover:bg-surface hover:text-ink ${active ? 'bg-surface text-ink' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
})

// ───────────────────────── Badges ─────────────────────────

export type SemanticState =
  | 'ONLINE' | 'OFFLINE' | 'UNKNOWN' | 'CHECKING'
  | 'ACTIVE' | 'DISABLED' | 'EXPIRED' | 'EXPIRING_SOON' | 'UNLIMITED'
  | 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'NOT_CONFIGURED' | 'CONFIGURED' | 'FAILED'

const STATE_STYLES: Record<SemanticState, { bg: string; fg: string; dot: string }> = {
  ONLINE: { bg: 'rgba(11,110,151,0.10)', fg: '#0b6e97', dot: '#0b6e97' },
  ACTIVE: { bg: 'rgba(11,110,151,0.10)', fg: '#0b6e97', dot: '#0b6e97' },
  HEALTHY: { bg: 'rgba(11,110,151,0.10)', fg: '#0b6e97', dot: '#0b6e97' },
  UNLIMITED: { bg: 'rgba(11,110,151,0.10)', fg: '#0b6e97', dot: '#0b6e97' },
  CONFIGURED: { bg: 'rgba(37,99,201,0.10)', fg: '#2563c9', dot: '#2563c9' },
  EXPIRING_SOON: { bg: 'rgba(180,83,9,0.10)', fg: '#b45309', dot: '#b45309' },
  CHECKING: { bg: 'rgba(180,83,9,0.10)', fg: '#b45309', dot: '#b45309' },
  DEGRADED: { bg: 'rgba(180,83,9,0.10)', fg: '#b45309', dot: '#b45309' },
  OFFLINE: { bg: 'rgba(220,38,38,0.08)', fg: '#dc2626', dot: '#dc2626' },
  FAILED: { bg: 'rgba(220,38,38,0.08)', fg: '#dc2626', dot: '#dc2626' },
  EXPIRED: { bg: 'rgba(220,38,38,0.08)', fg: '#dc2626', dot: '#dc2626' },
  UNAVAILABLE: { bg: 'rgba(220,38,38,0.08)', fg: '#dc2626', dot: '#dc2626' },
  DISABLED: { bg: 'rgba(113,119,132,0.12)', fg: '#717784', dot: '#717784' },
  UNKNOWN: { bg: 'rgba(113,119,132,0.12)', fg: '#717784', dot: '#717784' },
  NOT_CONFIGURED: { bg: 'rgba(113,119,132,0.12)', fg: '#717784', dot: '#717784' },
}

export function StatusBadge({ state, label }: { state: SemanticState; label?: string }) {
  const style = STATE_STYLES[state] ?? STATE_STYLES.UNKNOWN
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: style.bg, color: style.fg }}
    >
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: style.dot }} />
      {label ?? state.replace('_', ' ')}
    </span>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'navy' }) {
  const tones = {
    neutral: 'bg-surface text-ink-soft border-hairline',
    brand: 'bg-[rgba(37,99,201,0.08)] text-brand border-[rgba(37,99,201,0.18)]',
    navy: 'bg-navy-900 text-white border-navy-900',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

// ───────────────────────── Cards & stats ─────────────────────────

export function Card({ children, className = '', hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={`card ${hover ? 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]' : ''} ${className}`}>
      {children}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = 'light',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  accent?: 'light' | 'navy'
}) {
  if (accent === 'navy') {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-navy-900 p-5 text-white shadow-[var(--shadow-card)]">
        <div className="pixel-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-white/55">{label}</p>
            <p className="num mt-2 text-[28px] font-semibold leading-none">{value}</p>
            {hint && <p className="mt-2 text-xs text-white/60">{hint}</p>}
          </div>
          {icon && <div className="rounded-xl bg-white/10 p-2.5 text-brand-light">{icon}</div>}
        </div>
      </div>
    )
  }
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-soft">{label}</p>
          <p className="num mt-2 text-[28px] font-semibold leading-none text-ink">{value}</p>
          {hint && <p className="mt-2 text-xs text-ink-soft">{hint}</p>}
        </div>
        {icon && <div className="rounded-xl bg-surface p-2.5 text-brand">{icon}</div>}
      </div>
    </div>
  )
}

// ───────────────────────── Empty / loading ─────────────────────────

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-ink-soft">
        {icon ?? (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" opacity="0.4" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" opacity="0.4" />
            <circle cx="17.5" cy="17.5" r="3" />
          </svg>
        )}
      </div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-soft">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin text-ink-soft ${className}`} size={18} aria-label="Loading" />
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-soft">
      <Spinner /> {label}
    </div>
  )
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <p className="text-sm font-medium text-danger">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`inline-block animate-pulse rounded-lg bg-surface ${className}`} aria-hidden />
}

// ───────────────────────── Forms ─────────────────────────

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className = '',
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(props, ref) {
  return <input ref={ref} className="input-base" {...props} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(props, ref) {
  return <textarea ref={ref} className="input-base min-h-[80px] resize-y" {...props} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(props, ref) {
  return <select ref={ref} className="input-base appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23717784%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[position:right_0.65rem_center] bg-no-repeat pr-8" {...props} />
})

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ?? 'Toggle'}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5.5 w-10 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-brand' : 'bg-ghost'}`}
      style={{ height: 22 }}
    >
      <motion.span
        layout
        transition={springSoft}
        className="inline-block h-[16px] w-[16px] rounded-full bg-white shadow"
        style={{ marginInlineStart: checked ? 20 : 3 }}
      />
    </button>
  )
}

// ───────────────────────── Tabs ─────────────────────────

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: string; label: string }>
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div role="tablist" className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-surface p-1">
      {tabs.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`relative rounded-[9px] px-3.5 py-1.5 text-sm font-medium transition-colors ${isActive ? 'text-ink' : 'text-ink-soft hover:text-ink'}`}
          >
            {isActive && (
              <motion.span
                layoutId={`tab-${tabs.map((x) => x.id).join('.')}`}
                className="absolute inset-0 rounded-[9px] bg-surface-card shadow-[var(--shadow-card)]"
                transition={springSoft}
              />
            )}
            <span className="relative">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ───────────────────────── Pagination ─────────────────────────

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (p: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  return (
    <div className="flex items-center justify-between gap-3 border-t border-hairline px-4 py-3 text-sm">
      <p className="text-xs text-ink-soft">
        <span className="num font-medium text-ink">{total}</span> results — page <span className="num">{page}</span> of{' '}
        <span className="num">{pages}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Prev
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  )
}

// ───────────────────────── Copy ─────────────────────────

export function CopyButton({ text, label = 'Copy', size = 'sm' }: { text: string | null | undefined; label?: string; size?: ButtonSize }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="secondary"
      size={size}
      disabled={!text}
      onClick={async () => {
        if (!text) return
        try {
          await navigator.clipboard.writeText(text)
        } catch {
          const ta = document.createElement('textarea')
          ta.value = text
          document.body.appendChild(ta)
          ta.select()
          document.execCommand('copy')
          ta.remove()
        }
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? 'Copied' : label}
    </Button>
  )
}

export function LinkButton({
  href,
  variant = 'primary',
  size = 'md',
  children,
}: {
  href: string
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={`inline-flex select-none items-center justify-center rounded-[10px] font-medium transition-colors ${VARIANTS[variant]} ${SIZES[size]}`}
    >
      {children}
    </Link>
  )
}

export function MonoValue({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`mono rounded-md bg-surface px-1.5 py-0.5 text-ink ${className}`}>{children}</span>
}
