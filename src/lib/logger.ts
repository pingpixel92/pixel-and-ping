/**
 * Structured logging with secret redaction.
 * Never log: passwords, API tokens, session secrets, encryption keys, raw configs.
 */

const SENSITIVE_KEY_PATTERNS = [
  'password',
  'token',
  'secret',
  'authorization',
  'apikey',
  'api_key',
  'cookie',
  'credential',
  'keycipher',
  'session',
  'encryption',
  'config',
]

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase()
  return SENSITIVE_KEY_PATTERNS.some((p) => k.includes(p))
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[DEPTH]'
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    // Defensive: redact anything that looks like an issued API key or a cipher blob.
    if (value.startsWith('ppk_')) return value.slice(0, 8) + '…[REDACTED]'
    if (value.startsWith('v1.')) return '[REDACTED]'
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSensitiveKey(k) ? '[REDACTED]' : redact(v, depth + 1)
    }
    return out
  }
  return String(value)
}

type Level = 'debug' | 'info' | 'warn' | 'error'

function write(level: Level, msg: string, meta?: Record<string, unknown>) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta ? { meta: redact(meta) } : {}),
  })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'production') write('debug', msg, meta)
  },
  info: (msg: string, meta?: Record<string, unknown>) => write('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => write('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => write('error', msg, meta),
}
