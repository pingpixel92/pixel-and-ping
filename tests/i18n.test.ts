import { describe, expect, it } from 'vitest'
import { en } from '../src/lib/i18n/en'
import { fa } from '../src/lib/i18n/fa'
import { ru } from '../src/lib/i18n/ru'
import { zh } from '../src/lib/i18n/zh'
import { LOCALES } from '../src/lib/i18n/index'

const EN_KEYS = Object.keys(en)

describe('i18n dictionaries', () => {
  it('exposes exactly four locales with correct text direction', () => {
    expect(LOCALES.map((l) => l.id)).toEqual(['en', 'fa', 'ru', 'zh'])
    expect(LOCALES.find((l) => l.id === 'fa')?.dir).toBe('rtl')
    for (const l of LOCALES) {
      if (l.id !== 'fa') expect(l.dir).toBe('ltr')
    }
  })

  it('covers every English key in Persian', () => {
    const missing = EN_KEYS.filter((k) => !(k in fa) || !fa[k as keyof typeof fa]?.trim())
    expect(missing).toEqual([])
  })

  it('covers every English key in Russian', () => {
    const missing = EN_KEYS.filter((k) => !(k in ru) || !ru[k as keyof typeof ru]?.trim())
    expect(missing).toEqual([])
  })

  it('covers every English key in Chinese', () => {
    const missing = EN_KEYS.filter((k) => !(k in zh) || !zh[k as keyof typeof zh]?.trim())
    expect(missing).toEqual([])
  })

  it('keeps brand name and technical tokens untranslated where expected', () => {
    expect(en['app.name']).toBe('Pixel & Ping')
    expect(zh['ports.tls']).toBe('TLS')
    expect(ru['ports.tls']).toBe('TLS')
    expect(fa['ports.tls']).toBe('TLS')
  })
})
