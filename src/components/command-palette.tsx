'use client'

import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity, ArrowRight, BarChart3, Bell, Cable, Command, Cpu, FileCode2,
  KeyRound, LayoutDashboard, Radar, ScrollText, Server, Settings, Shuffle,
  UserPlus, Users, Waypoints,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api-client'
import { springSoft } from './reveal'

interface SearchResults {
  users: Array<{ id: string; username: string; displayName: string | null; status: string }>
  servers: Array<{ id: string; name: string; host: string; status: string }>
  endpoints: Array<{ id: string; name: string; address: string; port: number; status: string }>
  configs: Array<{ id: string; name: string; protocol: string }>
}

interface PageItem {
  id: string
  label: string
  href: string
  icon: React.ReactNode
}

const PAGES: PageItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={15} /> },
  { id: 'users', label: 'Users', href: '/users', icon: <Users size={15} /> },
  { id: 'users-create', label: 'Create User', href: '/users/create', icon: <UserPlus size={15} /> },
  { id: 'servers', label: 'Servers', href: '/servers', icon: <Server size={15} /> },
  { id: 'endpoints', label: 'Endpoints', href: '/endpoints', icon: <Waypoints size={15} /> },
  { id: 'ports', label: 'Ports', href: '/ports', icon: <Cable size={15} /> },
  { id: 'configs', label: 'Configs', href: '/configs', icon: <FileCode2 size={15} /> },
  { id: 'scanner', label: 'IP Scanner', href: '/ip-scanner', icon: <Radar size={15} /> },
  { id: 'traffic', label: 'Traffic', href: '/traffic', icon: <Activity size={15} /> },
  { id: 'analytics', label: 'Analytics', href: '/analytics', icon: <BarChart3 size={15} /> },
  { id: 'failover', label: 'Failover', href: '/failover', icon: <Shuffle size={15} /> },
  { id: 'logs', label: 'Logs', href: '/logs', icon: <ScrollText size={15} /> },
  { id: 'notifications', label: 'Notifications', href: '/notifications', icon: <Bell size={15} /> },
  { id: 'settings', label: 'Settings', href: '/settings', icon: <Settings size={15} /> },
  { id: 'api-keys', label: 'API Keys', href: '/api-keys', icon: <KeyRound size={15} /> },
  { id: 'system', label: 'System', href: '/system', icon: <Cpu size={15} /> },
]

interface CommandItem {
  id: string
  label: string
  hint?: string
  href: string
  icon: React.ReactNode
  group: string
}

/** Ctrl/⌘ + K command center: pages, actions and live database search. */
export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on open is intentional
      setQuery('')
      setResults(null)
      setActiveIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }, [open])

  // Debounced live search.
  useEffect(() => {
    if (!open || query.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing stale results is intentional
      setResults(null)
      return
    }
    const timer = setTimeout(async () => {
      try {
        const data = await api<SearchResults>(`/api/search?q=${encodeURIComponent(query.trim())}`)
        setResults(data)
      } catch {
        setResults(null)
      }
    }, 220)
    return () => clearTimeout(timer)
  }, [query, open])

  const items = useMemo<CommandItem[]>(() => {
    const q = query.trim().toLowerCase()
    const pages = PAGES.filter((p) => !q || p.label.toLowerCase().includes(q)).map((p) => ({
      id: p.id,
      label: p.label,
      hint: p.href,
      href: p.href,
      icon: p.icon,
      group: 'Pages',
    }))

    const out: CommandItem[] = [...pages]
    if (results) {
      results.users.forEach((u) =>
        out.push({
          id: `u-${u.id}`,
          label: u.displayName || u.username,
          hint: `User · ${u.username}`,
          href: `/users/${u.id}`,
          icon: <Users size={15} />,
          group: 'Users',
        }),
      )
      results.servers.forEach((s) =>
        out.push({
          id: `s-${s.id}`,
          label: s.name,
          hint: `Server · ${s.host}`,
          href: `/servers`,
          icon: <Server size={15} />,
          group: 'Servers',
        }),
      )
      results.endpoints.forEach((e) =>
        out.push({
          id: `e-${e.id}`,
          label: e.name,
          hint: `Endpoint · ${e.address}:${e.port}`,
          href: `/endpoints`,
          icon: <Waypoints size={15} />,
          group: 'Endpoints',
        }),
      )
      results.configs.forEach((c) =>
        out.push({
          id: `c-${c.id}`,
          label: c.name,
          hint: `Config · ${c.protocol}`,
          href: `/configs`,
          icon: <FileCode2 size={15} />,
          group: 'Configs',
        }),
      )
    }
    return out.slice(0, 14)
  }, [query, results])

  const select = useCallback(
    (item: CommandItem | undefined) => {
      if (!item) return
      setOpen(false)
      router.push(item.href)
    },
    [router],
  )

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      select(items[activeIndex])
    }
  }

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  let lastGroup = ''

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[95] flex items-start justify-center px-4 pt-[12vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }}>
          <div className="absolute inset-0 bg-navy-900/45 backdrop-blur-[3px]" onClick={() => setOpen(false)} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.12 } }}
            transition={springSoft}
            className="card relative w-full max-w-[560px] overflow-hidden shadow-[var(--shadow-pop)]"
          >
            <div className="flex items-center gap-2.5 border-b border-hairline px-4">
              <Command size={16} className="shrink-0 text-ink-soft" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActiveIndex(0)
                }}
                onKeyDown={onInputKey}
                placeholder="Search pages, users, servers, endpoints, configs…"
                aria-label="Command palette search"
                className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-ink-soft"
              />
              <kbd className="mono rounded border border-hairline bg-surface px-1.5 py-0.5 text-[10px] text-ink-soft">ESC</kbd>
            </div>
            <div ref={listRef} className="max-h-[340px] overflow-y-auto p-2" role="listbox">
              {items.length === 0 && <p className="px-3 py-8 text-center text-sm text-ink-soft">No matches.</p>}
              {items.map((item, index) => {
                const showGroup = item.group !== lastGroup
                lastGroup = item.group
                const isActive = index === activeIndex
                return (
                  <div key={item.id}>
                    {showGroup && (
                      <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{item.group}</p>
                    )}
                    <button
                      data-index={index}
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => select(item)}
                      className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-start text-sm transition-colors ${isActive ? 'bg-brand text-white' : 'text-ink hover:bg-surface'}`}
                    >
                      <span className={isActive ? 'text-white' : 'text-ink-soft'}>{item.icon}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                      {item.hint && (
                        <span className={`shrink-0 truncate text-xs ${isActive ? 'text-white/70' : 'text-ink-soft'}`}>{item.hint}</span>
                      )}
                      <ArrowRight size={13} className={isActive ? 'text-white/80' : 'text-ghost'} />
                    </button>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
