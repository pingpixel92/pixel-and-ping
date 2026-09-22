/** Formatting helpers — UTC storage, locale display. */

export function formatBytes(bytes: number | string | null | undefined): string {
  const n = typeof bytes === 'string' ? Number(bytes) : (bytes ?? 0)
  if (!Number.isFinite(n) || n === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(Math.abs(n)) / Math.log(1024)))
  const value = n / 1024 ** i
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[i]}`
}

export function formatNumber(n: number | string | null | undefined): string {
  const value = typeof n === 'string' ? Number(n) : (n ?? 0)
  if (!Number.isFinite(value)) return '0'
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'never'
  const diff = Date.now() - d.getTime()
  const abs = Math.abs(diff)
  const suffix = diff >= 0 ? 'ago' : 'from now'
  if (abs < 45_000) return 'just now'
  if (abs < 3_600_000) return `${Math.round(abs / 60_000)}m ${suffix}`
  if (abs < 86_400_000) return `${Math.round(abs / 3_600_000)}h ${suffix}`
  return `${Math.round(abs / 86_400_000)}d ${suffix}`
}

export function greetingKey(date = new Date()): 'greeting.morning' | 'greeting.afternoon' | 'greeting.evening' {
  const h = date.getHours()
  if (h < 12) return 'greeting.morning'
  if (h < 18) return 'greeting.afternoon'
  return 'greeting.evening'
}

export function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
