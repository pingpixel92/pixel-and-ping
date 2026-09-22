'use client'

import { useState } from 'react'
import { CommandPalette } from '../command-palette'
import { MobileSidebar, Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { PageTransition } from '../reveal'

/** Premium dashboard shell: desktop sidebar + collapsible mode, mobile drawer, command palette. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  function toggleCollapse() {
    setCollapsed((v) => !v)
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 border-e border-hairline bg-surface-card transition-[width] duration-200 lg:block ${collapsed ? 'w-[76px]' : 'w-[248px]'}`}
        aria-label="Sidebar"
      >
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      </aside>

      {/* Mobile drawer */}
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)}>
        <Sidebar collapsed={false} onToggleCollapse={() => setMobileOpen(false)} mobileOpen onMobileClose={() => setMobileOpen(false)} />
      </MobileSidebar>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileOpen(true)} onToggleCollapse={toggleCollapse} />
        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1200px]">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>
        <footer className="mt-auto border-t border-hairline px-4 py-4 md:px-6 lg:px-8">
          <p className="text-center text-[11px] text-ink-soft">
            Pixel &amp; Ping — Infrastructure Panel · {new Date().getFullYear()}
          </p>
        </footer>
      </div>

      <CommandPalette />
    </div>
  )
}
