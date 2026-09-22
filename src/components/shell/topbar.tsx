'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Bell, Check, CheckCheck, Globe, LogOut, Menu, PanelLeft, Search, UserRound } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api-client'
import { timeAgo } from '@/lib/format'
import { useI18n, LOCALES, type TranslationKey } from '@/lib/i18n'
import { springSoft } from '../reveal'
import { Badge, IconButton } from '../ui-primitives'
import { useMe } from './auth-gate'

const TITLES: Array<[RegExp, TranslationKey]> = [
  [/^\/dashboard/, 'nav.dashboard'],
  [/^\/users\/create/, 'nav.createUser'],
  [/^\/users\/[^/]+/, 'nav.userDetails'],
  [/^\/users/, 'nav.users'],
  [/^\/servers/, 'nav.servers'],
  [/^\/endpoints/, 'nav.endpoints'],
  [/^\/ports/, 'nav.ports'],
  [/^\/configs/, 'nav.configs'],
  [/^\/ip-scanner/, 'nav.scanner'],
  [/^\/traffic/, 'nav.traffic'],
  [/^\/analytics/, 'nav.analytics'],
  [/^\/failover/, 'nav.failover'],
  [/^\/logs/, 'nav.logs'],
  [/^\/notifications/, 'nav.notifications'],
  [/^\/settings/, 'nav.settings'],
  [/^\/api-keys/, 'nav.apiKeys'],
  [/^\/system/, 'nav.system'],
]

interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
}

export function Topbar({ onMenu, onToggleCollapse }: { onMenu: () => void; onToggleCollapse: () => void }) {
  const router = useRouter()
  const pathname = usePathname()
  const { t, locale, setLocale } = useI18n()
  const { user, unreadCount, setUnreadCount } = useMe()
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const notifRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const langRef = useRef<HTMLDivElement>(null)

  const title = t(TITLES.find(([re]) => re.test(pathname))?.[1] ?? 'app.name')

  // Close popovers on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  async function openNotifications() {
    const next = !notifOpen
    setNotifOpen(next)
    if (next) {
      try {
        const data = await api<{ items: NotificationItem[] }>('/api/notifications?pageSize=8')
        setNotifications(data.items)
        // Opening the panel marks everything as read through the real API.
        if (data.items.some((n) => !n.read)) {
          const res = await api<{ unreadCount: number }>('/api/notifications/read-all', { method: 'POST' })
          setUnreadCount(res.unreadCount)
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
        }
      } catch {
        /* surfaced as empty panel */
      }
    }
  }

  async function logout() {
    try {
      await api('/api/auth/logout', { method: 'POST' })
    } finally {
      router.push('/login')
      router.refresh()
    }
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-hairline bg-white/85 px-4 backdrop-blur-md md:px-6">
      <IconButton label="Open navigation" onClick={onMenu} className="lg:hidden">
        <Menu size={18} />
      </IconButton>
      <IconButton label="Toggle sidebar" onClick={onToggleCollapse} className="hidden lg:inline-flex">
        <PanelLeft size={17} />
      </IconButton>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">{title}</p>
      </div>

      <div className="flex-1" />

      {/* Search trigger — opens command palette via Ctrl+K or click. */}
      <button
        onClick={() => {
          const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
          document.dispatchEvent(event)
        }}
        className="hidden h-9 w-56 items-center gap-2 rounded-[10px] border border-hairline bg-surface px-3 text-sm text-ink-soft transition-colors hover:border-ghost md:flex"
        aria-label="Open command palette (Ctrl+K)"
      >
        <Search size={15} />
        <span className="flex-1 text-start">{t('common.search')}…</span>
        <kbd className="mono rounded border border-hairline bg-white px-1.5 py-0.5 text-[10px]">⌘K</kbd>
      </button>
      <IconButton label="Search (Ctrl+K)" className="md:hidden" onClick={() => {
        const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
        document.dispatchEvent(event)
      }}>
        <Search size={18} />
      </IconButton>

      {/* Language quick switcher — en / fa (RTL) / ru / zh. */}
      <div className="relative" ref={langRef}>
        <IconButton label={t('language.label')} onClick={() => setLangOpen((v) => !v)} active={langOpen}>
          <Globe size={17} />
        </IconButton>
        <AnimatePresence>
          {langOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
              transition={springSoft}
              className="card absolute end-0 top-11 z-50 w-44 overflow-hidden p-1.5 shadow-[var(--shadow-pop)]"
              role="menu"
              aria-label={t('language.label')}
            >
              {LOCALES.map((l) => (
                <button
                  key={l.id}
                  role="menuitem"
                  onClick={() => {
                    setLocale(l.id)
                    setLangOpen(false)
                  }}
                  aria-current={locale === l.id}
                  className={`flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-sm transition-colors hover:bg-surface ${
                    locale === l.id ? 'font-semibold text-brand' : 'text-ink'
                  }`}
                >
                  <span>{l.label}</span>
                  {locale === l.id && <Check size={14} />}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Notifications */}
      <div className="relative" ref={notifRef}>
        <IconButton label={`Notifications (${unreadCount} unread)`} onClick={openNotifications} active={notifOpen}>
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="num absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </IconButton>
        <AnimatePresence>
          {notifOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
              transition={springSoft}
              className="card absolute end-0 top-11 z-50 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden shadow-[var(--shadow-pop)]"
              role="dialog"
              aria-label="Notifications"
            >
              <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
                <p className="text-sm font-semibold text-ink">{t('notifications.title')}</p>
                <Link href="/notifications" onClick={() => setNotifOpen(false)} className="text-xs font-medium text-brand hover:underline">
                  {t('common.viewAll')}
                </Link>
              </div>
              <div className="max-h-[320px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
                    <CheckCheck size={20} className="text-ghost" />
                    <p className="text-sm text-ink-soft">{t('notifications.allCaughtUp')}</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="border-b border-hairline px-4 py-3 last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-ink">{n.title}</p>
                        <Badge tone={n.type === 'HEALTH' ? 'brand' : 'neutral'}>{n.type}</Badge>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{n.message}</p>
                      <p className="mt-1 text-[10px] text-ink-soft">{timeAgo(n.createdAt)}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Profile */}
      <div className="relative" ref={profileRef}>
        <button
          onClick={() => setProfileOpen((v) => !v)}
          className="flex items-center gap-2.5 rounded-[10px] px-2 py-1.5 transition-colors hover:bg-surface"
          aria-haspopup="menu"
          aria-expanded={profileOpen}
          aria-label="Account menu"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-xs font-semibold text-white">
            {(user?.displayName ?? user?.username ?? '?').slice(0, 2).toUpperCase()}
          </span>
          <span className="hidden text-start md:block">
            <span className="block max-w-[140px] truncate text-xs font-semibold leading-tight text-ink">{user?.displayName ?? user?.username}</span>
            <span className="block text-[10px] leading-tight text-ink-soft">{user?.role}</span>
          </span>
        </button>
        <AnimatePresence>
          {profileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
              transition={springSoft}
              className="card absolute end-0 top-12 z-50 w-56 overflow-hidden p-1.5 shadow-[var(--shadow-pop)]"
              role="menu"
            >
              <div className="px-3 py-2">
                <p className="truncate text-sm font-semibold text-ink">{user?.displayName ?? user?.username}</p>
                <p className="truncate text-xs text-ink-soft">{user?.email}</p>
              </div>
              <div className="my-1 h-px bg-hairline" />
              <Link
                href="/settings"
                onClick={() => setProfileOpen(false)}
                role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2 text-sm text-ink transition-colors hover:bg-surface"
              >
                <UserRound size={15} /> {t('settings.account')}
              </Link>
              <button
                onClick={logout}
                role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2 text-sm text-danger transition-colors hover:bg-[rgba(220,38,38,0.06)]"
              >
                <LogOut size={15} /> {t('common.logout')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}
