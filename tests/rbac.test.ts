import { describe, expect, it } from 'vitest'
import { can, rolesFor } from '../src/lib/rbac'
import { getProvider, listProviders, ProviderNotConfiguredError } from '../src/lib/services/providers'
import type { BuildConfigInput } from '../src/lib/services/providers'

describe('RBAC matrix', () => {
  it('grants admins every permission', () => {
    expect(can('ADMIN', 'users:write')).toBe(true)
    expect(can('ADMIN', 'settings:manage')).toBe(true)
    expect(can('ADMIN', 'danger:execute')).toBe(true)
    expect(can('ADMIN', 'audit:read')).toBe(true)
  })

  it('lets operators manage infrastructure but not settings', () => {
    expect(can('OPERATOR', 'users:write')).toBe(true)
    expect(can('OPERATOR', 'infra:write')).toBe(true)
    expect(can('OPERATOR', 'settings:manage')).toBe(false)
    expect(can('OPERATOR', 'apikeys:manage')).toBe(false)
  })

  it('restricts viewers to reads', () => {
    expect(can('VIEWER', 'users:read')).toBe(true)
    expect(can('VIEWER', 'users:write')).toBe(false)
    expect(can('VIEWER', 'infra:write')).toBe(false)
  })

  it('every permission maps to at least the ADMIN role', () => {
    for (const permission of ['users:read', 'danger:execute'] as const) {
      expect(rolesFor(permission)).toContain('ADMIN')
    }
  })
})

describe('network providers (real config builders)', () => {
  const base: BuildConfigInput = {
    username: 'alice',
    displayName: 'Alice Phone',
    host: 'vpn.example.com',
    port: 443,
    tls: true,
    sni: 'cdn.example.com',
    credentials: { uuid: '11111111-2222-3333-4444-555555555555' },
  }

  it('builds a valid VLESS URI', () => {
    const cfg = getProvider('VLESS').buildConfig(base)
    expect(cfg).toMatch(/^vless:\/\/11111111-2222-3333-4444-555555555555@vpn\.example\.com:443\?/)
    expect(cfg).toContain('security=tls')
    expect(cfg).toContain('sni=cdn.example.com')
    expect(cfg.endsWith('#Alice%20Phone')).toBe(true)
  })

  it('builds a valid VMess base64 JSON', () => {
    const cfg = getProvider('VMESS').buildConfig(base)
    expect(cfg.startsWith('vmess://')).toBe(true)
    const json = JSON.parse(Buffer.from(cfg.slice(8), 'base64').toString('utf8'))
    expect(json.add).toBe('vpn.example.com')
    expect(json.port).toBe('443')
    expect(json.tls).toBe('tls')
  })

  it('builds a valid Trojan URI with a password credential', () => {
    const provider = getProvider('TROJAN')
    const creds = provider.createCredentials()
    expect(creds.password).toBeTruthy()
    const cfg = provider.buildConfig({ ...base, credentials: creds })
    expect(cfg).toMatch(/^trojan:\/\/.+@vpn\.example\.com:443/)
  })

  it('builds a SIP002 Shadowsocks URI', () => {
    const provider = getProvider('SHADOWSOCKS')
    const creds = provider.createCredentials()
    expect(creds.method).toBe('aes-256-gcm')
    const cfg = provider.buildConfig({ ...base, credentials: creds })
    expect(cfg.startsWith('ss://')).toBe(true)
    const userInfo = cfg.slice(5).split('@')[0]
    expect(Buffer.from(userInfo, 'base64url').toString('utf8')).toContain('aes-256-gcm:')
  })

  it('marks transport protocols as not configured (honesty rule)', () => {
    for (const protocol of ['HTTPS', 'HTTP', 'TCP'] as const) {
      const provider = getProvider(protocol)
      expect(provider.implemented).toBe(false)
      expect(() => provider.createCredentials()).toThrow(ProviderNotConfiguredError)
    }
    const ids = listProviders().map((p) => p.id)
    expect(ids).toContain('VLESS')
    expect(ids).toContain('TCP')
  })
})
