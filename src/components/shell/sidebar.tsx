'use client'

import {
  Activity, BarChart3, Bell, Cable, ChevronLeft, Cpu, FileCode2, KeyRound,
  LayoutDashboard, Radar, ScrollText, Server, Settings, Shuffle, UserPlus,
  Users, Waypoints, X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useI18n, type TranslationKey } from '@/lib/i18n'
import { springSoft } from '../reveal'
import { Logo } from '../logo'

interface NavItem {
  href: string
  labelKey: TranslationKey
  icon: React.ReactNode
  exact?: boolean
}

interface NavGroup {
  labelKey: TranslationKey
  items: NavItem[]
}

export const NAV: NavGroup[] = [
  {
    labelKey: 'nav.group.overview',
    items: [{ href: '/dashboard', labelKey: 'nav.dashboard', icon: <LayoutDashboard size={17} />, exact: true }],
  },
  {
    labelKey: 'nav.group.management',
    items: [
      { href: '/users', labelKey: 'nav.users', icon: <Users size={17} /> },
      { href: '/users/create', labelKey: 'nav.createUser', icon: <UserPlus size={17} />, exact: true },
      { href: '/servers', labelKey: 'nav.servers', icon: <Server size={17} /> },
      { href: '/endpoints', labelKey: 'nav.endpoints', icon: <Waypoints size={17} /> },
      { href: '/ports', labelKey: 'nav.ports', icon: <Cable size={17} /> },
      { href: '/configs', labelKey: 'nav.configs', icon: <FileCode2 size={17} /> },
    ],
  },
  {
    labelKey: 'nav.group.network',
    items: [
      { href: '/ip-scanner', labelKey: 'nav.scanner', icon: <Radar size={17} /> },
      { href: '/traffic', labelKey: 'nav.traffic', icon: <Activity size={17} /> },
      { href: '/analytics', labelKey: 'nav.analytics', icon: <BarChart3 size={17} /> },
      { href: '/failover', labelKey: 'nav.failover', icon: <Shuffle size={17} /> },
    ],
  },
  {
    labelKey: 'nav.group.system',
    items: [
      { href: '/logs', labelKey: 'nav.logs', icon: <ScrollText size={17} /> },
      { href: '/notifications', labelKey: 'nav.notifications', icon: <Bell size={17} /> },
      { href: '/settings', labelKey: 'nav.settings', icon: <Settings size={17} /> },
      { href: '/api-keys', labelKey: 'nav.apiKeys', icon: <KeyRound size={17} /> },
      { href: '/system', labelKey: 'nav.system', icon: <Cpu size={17} /> },
    ],
  },
]

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href
  if (item.href === '/users') return pathname === '/users' || (pathname.startsWith('/users/') && !pathname.startsWith('/users/create'))
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const { t } = useI18n()

  const content = (
    <div className="flex h-full flex-col">
      <div className={`flex h-16 items-center border-b border-hairline px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        <Link href="/dashboard" aria-label="Pixel & Ping home" onClick={onMobileClose}>
          <Logo size={collapsed ? 32 : 30} withWordmark={!collapsed} />
        </Link>
        {!collapsed && onMobileClose && (
          <button aria-label="Close navigation" onClick={onMobileClose} className="rounded-lg p-1.5 text-ink-soft hover:bg-surface lg:hidden">
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Primary">
        {NAV.map((group) => (
          <div key={group.labelKey} className="mb-5 last:mb-0">
            {!collapsed && (
              <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft/70">{t(group.labelKey)}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onMobileClose}
                      title={collapsed ? t(item.labelKey) : undefined}
                      aria-current={active ? 'page' : undefined}
                      className={`group relative flex items-center gap-3 rounded-[10px] px-2.5 py-2 text-sm font-medium transition-all ${active ? 'text-white' : 'text-ink-soft hover:text-ink'} ${collapsed ? 'justify-center' : ''}`}
                    >
                      {active && (
                        <motion.span
                          layoutId="sidebar-active"
                          transition={springSoft}
                          className="absolute inset-0 rounded-[10px] bg-navy-900"
                        />
                      )}
                      <span className="relative transition-transform duration-150 group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5">{item.icon}</span>
                      {!collapsed && <span className="relative truncate">{t(item.labelKey)}</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-hairline p-3">
        <button
          onClick={onToggleCollapse}
          className={`flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-xs font-medium text-ink-soft transition-colors hover:bg-surface hover:text-ink ${collapsed ? 'justify-center' : ''}`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft size={15} className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </div>
  )

  if (mobileOpen !== undefined && onMobileClose) {
    // Mobile drawer instance is rendered by app-shell; desktop is inline.
  }

  return content
}

export function MobileSidebar({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  return (
    <>
      {open && <div className="fixed inset-0 z-[70] bg-navy-900/40 backdrop-blur-[2px] lg:hidden" onClick={onClose} aria-hidden />}
      <motion.aside
        className="fixed inset-y-0 start-0 z-[75] w-[272px] bg-surface-card shadow-[var(--shadow-pop)] lg:hidden"
        initial={false}
        animate={{ x: open ? 0 : '-100%' }}
        transition={springSoft}
        aria-label="Mobile navigation"
        style={{ insetInlineStart: 0 }}
      >
        {children}
      </motion.aside>
    </>
  )
}
