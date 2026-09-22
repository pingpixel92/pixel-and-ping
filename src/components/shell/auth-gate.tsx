'use client'

import { useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '@/lib/api-client'
import { Logo } from '../logo'
import { Spinner } from '../ui-primitives'
import { useToast } from '../toast'

export interface Me {
  id: string
  email: string
  username: string
  displayName: string
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER'
  status: string
  lastLoginAt: string | null
  prefs: Record<string, unknown>
  createdAt: string
}

interface MeContextValue {
  user: Me | null
  unreadCount: number
  refresh: () => Promise<void>
  setUnreadCount: (n: number) => void
}

const MeContext = createContext<MeContextValue | null>(null)

export function useMe(): MeContextValue {
  const ctx = useContext(MeContext)
  if (!ctx) throw new Error('useMe must be used inside AuthGate')
  return ctx
}

/** Client-side auth gate: real session check against /api/me. */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const toast = useToast()
  const [user, setUser] = useState<Me | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [state, setState] = useState<'loading' | 'ready'>('loading')

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: Me | null; unreadCount: number }>('/api/me')
      if (!data.user) {
        router.replace('/login')
        return
      }
      setUser(data.user)
      setUnreadCount(data.unreadCount)
      setState('ready')
    } catch (err) {
      // /api/me is in SKIP_REDIRECT — handle 401 manually.
      if (err instanceof Error && 'status' in err && (err as { status: number }).status === 401) {
        router.replace('/login')
        return
      }
      toast.error('Session check failed', 'Could not verify your session. Retrying may help.')
      setState('ready')
    }
  }, [router, toast])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async session probe; state updates happen after await
    void refresh()
  }, [refresh])

  useEffect(() => {
    const timer = setInterval(() => void refresh(), 90_000)
    return () => clearInterval(timer)
  }, [refresh])

  const value = useMemo<MeContextValue>(
    () => ({ user, unreadCount, refresh, setUnreadCount }),
    [user, unreadCount, refresh],
  )

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <Logo size={40} />
        <Spinner />
      </div>
    )
  }

  return <MeContext.Provider value={value}>{children}</MeContext.Provider>
}
