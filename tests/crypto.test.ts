import { describe, expect, it } from 'vitest'
import {
  encryptSecret,
  decryptSecret,
  generateApiKey,
  hashPassword,
  newSecret,
  newUuid,
  sha256,
  verifyPassword,
} from '../src/lib/crypto'

describe('password hashing (scrypt)', () => {
  it('hashes and verifies a password', () => {
    const hash = hashPassword('Correct-Horse-9')
    expect(hash.startsWith('scrypt$')).toBe(true)
    expect(verifyPassword('Correct-Horse-9', hash)).toBe(true)
  })

  it('rejects wrong passwords', () => {
    const hash = hashPassword('Correct-Horse-9')
    expect(verifyPassword('wrong', hash)).toBe(false)
    expect(verifyPassword('', hash)).toBe(false)
  })

  it('produces unique salts', () => {
    expect(hashPassword('same')).not.toBe(hashPassword('same'))
  })

  it('rejects malformed stored hashes safely', () => {
    expect(verifyPassword('x', 'garbage')).toBe(false)
  })
})

describe('AES-256-GCM secret encryption', () => {
  it('round-trips a Cloudflare token', () => {
    const token = 'cf-token-abcdef0123456789'
    const cipher = encryptSecret(token)
    expect(cipher.startsWith('v1.')).toBe(true)
    expect(cipher).not.toContain(token)
    expect(decryptSecret(cipher)).toBe(token)
  })

  it('produces different ciphertexts per call', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'))
  })

  it('rejects tampered ciphertext', () => {
    const cipher = encryptSecret('secret-data')
    const parts = cipher.split('.')
    parts[3] = Buffer.from('tampered').toString('base64')
    expect(() => decryptSecret(parts.join('.'))).toThrow()
  })
})

describe('API keys', () => {
  it('generates unique prefixed keys with matching hash', () => {
    const a = generateApiKey()
    const b = generateApiKey()
    expect(a.key.startsWith('ppk_')).toBe(true)
    expect(a.key).not.toBe(b.key)
    expect(a.keyHash).toBe(sha256(a.key))
    expect(a.prefix).toBe(a.key.slice(0, 12))
  })

  it('never stores the plaintext key', () => {
    const { key, keyHash } = generateApiKey()
    expect(keyHash).not.toContain(key)
  })
})

describe('credential helpers', () => {
  it('generates valid UUIDs and secrets', () => {
    expect(newUuid()).toMatch(/^[0-9a-f-]{36}$/)
    expect(newSecret(24)).toHaveLength(24)
  })
})
