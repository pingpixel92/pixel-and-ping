'use client'

import { AuthGate } from '@/components/shell/auth-gate'
import { AppShell } from '@/components/shell/app-shell'

/** Protected panel layout — real session verification happens in /api/me. */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  )
}
