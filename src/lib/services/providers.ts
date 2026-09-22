import type { ProxyProtocol } from '@prisma/client'
import { newSecret, newUuid } from '@/lib/crypto'

/**
 * Network provider abstraction.
 * Each proxy protocol is implemented by a real provider that generates
 * working client configurations. Protocols without a provider resolve to
 * NullProvider and the UI honestly reports "Provider not configured".
 */

export interface ProviderCredentials {
  uuid?: string
  password?: string
  method?: string
}

export interface BuildConfigInput {
  username: string
  displayName?: string | null
  host: string
  port: number
  tls: boolean
  sni?: string | null
  credentials: ProviderCredentials
}

export class ProviderNotConfiguredError extends Error {
  constructor(public protocol: string) {
    super(`Provider for ${protocol} is not configured.`)
    this.name = 'ProviderNotConfiguredError'
  }
}

export interface NetworkProvider {
  id: ProxyProtocol
  label: string
  implemented: boolean
  createCredentials(): ProviderCredentials
  buildConfig(input: BuildConfigInput): string
}

function label(name: string): string {
  return encodeURIComponent(name)
}

class VlessProvider implements NetworkProvider {
  id = 'VLESS' as const
  label = 'VLESS (XTLS ecosystem)'
  implemented = true
  createCredentials(): ProviderCredentials {
    return { uuid: newUuid() }
  }
  buildConfig(input: BuildConfigInput): string {
    const { host, port, tls, sni, credentials } = input
    const params = new URLSearchParams({
      type: 'tcp',
      security: tls ? 'tls' : 'none',
      encryption: 'none',
      flow: '',
    })
    if (tls && sni) params.set('sni', sni)
    return `vless://${credentials.uuid}@${host}:${port}?${params.toString()}#${label(input.displayName || input.username)}`
  }
}

class VmessProvider implements NetworkProvider {
  id = 'VMESS' as const
  label = 'VMess (V2Ray)'
  implemented = true
  createCredentials(): ProviderCredentials {
    return { uuid: newUuid() }
  }
  buildConfig(input: BuildConfigInput): string {
    const { host, port, tls, sni, credentials } = input
    const json = {
      v: '2',
      ps: input.displayName || input.username,
      add: host,
      port: String(port),
      id: credentials.uuid,
      aid: '0',
      scy: 'auto',
      net: 'tcp',
      type: 'none',
      host: sni ?? '',
      path: '',
      tls: tls ? 'tls' : '',
      sni: sni ?? '',
      verify_cert: tls,
    }
    return `vmess://${Buffer.from(JSON.stringify(json), 'utf8').toString('base64')}`
  }
}

class TrojanProvider implements NetworkProvider {
  id = 'TROJAN' as const
  label = 'Trojan-GFW'
  implemented = true
  createCredentials(): ProviderCredentials {
    return { password: newSecret(24) }
  }
  buildConfig(input: BuildConfigInput): string {
    const { host, port, tls, sni, credentials } = input
    const params = new URLSearchParams({ security: tls ? 'tls' : 'none', type: 'tcp' })
    if (tls && sni) params.set('sni', sni)
    return `trojan://${encodeURIComponent(credentials.password ?? '')}@${host}:${port}?${params.toString()}#${label(input.displayName || input.username)}`
  }
}

class ShadowsocksProvider implements NetworkProvider {
  id = 'SHADOWSOCKS' as const
  label = 'Shadowsocks (SIP002)'
  implemented = true
  createCredentials(): ProviderCredentials {
    return { password: newSecret(24), method: 'aes-256-gcm' }
  }
  buildConfig(input: BuildConfigInput): string {
    const { host, port, credentials } = input
    const userInfo = Buffer.from(`${credentials.method}:${credentials.password}`, 'utf8').toString('base64url')
    return `ss://${userInfo}@${host}:${port}#${label(input.displayName || input.username)}`
  }
}

class NullProvider implements NetworkProvider {
  id: ProxyProtocol
  label: string
  implemented = false
  constructor(id: ProxyProtocol) {
    this.id = id
    this.label = `${id} (transport target only)`
  }
  createCredentials(): ProviderCredentials {
    throw new ProviderNotConfiguredError(this.id)
  }
  buildConfig(): string {
    throw new ProviderNotConfiguredError(this.id)
  }
}

const IMPLEMENTED: Record<string, NetworkProvider> = {
  VLESS: new VlessProvider(),
  VMESS: new VmessProvider(),
  TROJAN: new TrojanProvider(),
  SHADOWSOCKS: new ShadowsocksProvider(),
}

export function getProvider(protocol: ProxyProtocol): NetworkProvider {
  return IMPLEMENTED[protocol] ?? new NullProvider(protocol)
}

export function listProviders(): Array<{ id: string; label: string; implemented: boolean }> {
  const all: ProxyProtocol[] = ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS', 'HTTPS', 'HTTP', 'TCP']
  return all.map((p) => {
    const provider = IMPLEMENTED[p] ?? new NullProvider(p)
    return { id: p, label: provider.label, implemented: provider.implemented }
  })
}
