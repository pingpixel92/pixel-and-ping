'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { en, type TranslationKey } from './en'

export type { TranslationKey } from './en'
import { fa } from './fa'
import { ru } from './ru'
import { zh } from './zh'

export type Locale = 'en' | 'fa' | 'ru' | 'zh'

const DICTS: Record<Locale, Partial<Record<TranslationKey, string>>> = { en, fa, ru, zh }

export const LOCALES: Array<{ id: Locale; label: string; dir: 'ltr' | 'rtl' }> = [
  { id: 'en', label: 'English', dir: 'ltr' },
  { id: 'fa', label: 'فارسی', dir: 'rtl' },
  { id: 'ru', label: 'Русский', dir: 'ltr' },
  { id: 'zh', label: '中文', dir: 'ltr' },
]

interface I18nContextValue {
  locale: Locale
  dir: 'ltr' | 'rtl'
  setLocale: (l: Locale) => void
  t: (key: TranslationKey) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children, initialLocale = 'en' }: { children: ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  useEffect(() => {
    const stored = window.localStorage.getItem('pp_locale') as Locale | null
    if (stored && stored in DICTS) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-mount sync (hydration-safe)
      setLocaleState(stored)
    }
  }, [])

  useEffect(() => {
    const dir = locale === 'fa' ? 'rtl' : 'ltr'
    document.documentElement.dir = dir
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    window.localStorage.setItem('pp_locale', l)
  }, [])

  const t = useCallback(
    (key: TranslationKey): string => {
      return DICTS[locale][key] ?? en[key] ?? key
    },
    [locale],
  )

  const value = useMemo<I18nContextValue>(
    () => ({ locale, dir: locale === 'fa' ? 'rtl' : 'ltr', setLocale, t }),
    [locale, setLocale, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}
