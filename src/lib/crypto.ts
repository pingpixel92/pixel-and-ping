import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from 'crypto'

// ───────────────────────── Password hashing (scrypt) ─────────────────────────

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const
const KEY_LEN = 64

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, KEY_LEN, SCRYPT_PARAMS)
  return [
    'scrypt',
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    salt.toString('base64'),
    hash.toString('base64'),
  ].join('$')
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, n, r, p, saltB64, hashB64] = stored.split('$')
    if (scheme !== 'scrypt') return false
    const salt = Buffer.from(saltB64, 'base64')
    const expected = Buffer.from(hashB64, 'base64')
    const actual = scryptSync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    })
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

// ───────────────────────── AES-256-GCM secret encryption ─────────────────────────

function encryptionKey(): Buffer {
  return createHash('sha256')
    .update(process.env.ENCRYPTION_KEY ?? process.env.SESSION_SECRET ?? 'pixel-ping-fallback-key')
    .digest()
}

/** Output format: v1.<iv>.<tag>.<ciphertext> (all base64). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join('.')
}

export function decryptSecret(cipherText: string): string {
  const [version, ivB64, tagB64, dataB64] = cipherText.split('.')
  if (version !== 'v1') throw new Error('Unsupported cipher version')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8')
}

// ───────────────────────── Hashing & tokens ─────────────────────────

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

/** Generates an API key. The full key is returned exactly once by the creation endpoint. */
export function generateApiKey(): { key: string; prefix: string; keyHash: string } {
  const key = `ppk_${randomBytes(24).toString('base64url')}`
  return { key, prefix: key.slice(0, 12), keyHash: sha256(key) }
}

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

// ───────────────────────── Credential generation for providers ─────────────────────────

export function newUuid(): string {
  return randomUUID()
}

export function newSecret(len = 20): string {
  return randomBytes(32).toString('base64url').replace(/[-_]/g, '').slice(0, len)
}
