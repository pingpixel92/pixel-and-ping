/**
 * Centralized environment access.
 * Only variables that are actually used by the application are declared here.
 */
function str(name: string): string | undefined {
  const v = process.env[name]
  return v && v.length > 0 ? v : undefined
}

const NODE_ENV = str('NODE_ENV') ?? 'development'
const IS_PROD = NODE_ENV === 'production'

const DATABASE_URL = str('DATABASE_URL')
if (IS_PROD && !DATABASE_URL) {
  // Fail fast in production — a missing database URL is unrecoverable.
  throw new Error('DATABASE_URL is required in production.')
}

const SESSION_SECRET = str('SESSION_SECRET') ?? 'pixel-ping-development-session-secret'
if (IS_PROD && SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters in production.')
}

// Falls back to SESSION_SECRET when not provided (documented in .env.example).
const ENCRYPTION_KEY = str('ENCRYPTION_KEY') ?? SESSION_SECRET
if (IS_PROD && ENCRYPTION_KEY.length < 32) {
  throw new Error('ENCRYPTION_KEY must be at least 32 characters in production.')
}

export const env = {
  NODE_ENV,
  IS_PROD,
  DATABASE_URL: DATABASE_URL ?? '',
  SESSION_SECRET,
  ENCRYPTION_KEY,
  CORS_ORIGIN: str('CORS_ORIGIN') ?? null,
  SETUP_TOKEN: str('SETUP_TOKEN') ?? null,
} as const
