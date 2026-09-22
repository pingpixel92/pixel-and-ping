'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { springSoft } from './reveal'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: number
  type: ToastType
  title: string
  message?: string
}

interface ToastContextValue {
  push: (type: ToastType, title: string, message?: string) => void
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const ICONS: Record<ToastType, ReactNode> = {
  success: <CheckCircle2 size={17} style={{ color: '#0b6e97' }} />,
  error: <XCircle size={17} style={{ color: '#dc2626' }} />,
  warning: <AlertTriangle size={17} style={{ color: '#b45309' }} />,
  info: <Info size={17} style={{ color: '#2563c9' }} />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (type: ToastType, title: string, message?: string) => {
      const id = nextId.current++
      setToasts((prev) => [...prev.slice(-4), { id, type, title, message }])
      setTimeout(() => dismiss(id), type === 'error' ? 7000 : 4500)
    },
    [dismiss],
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (t, m) => push('success', t, m),
      error: (t, m) => push('error', t, m),
      warning: (t, m) => push('warning', t, m),
      info: (t, m) => push('info', t, m),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-[360px] flex-col gap-2 px-1 max-md:left-4 max-md:right-4 max-md:max-w-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
              transition={springSoft}
              className="card pointer-events-auto flex items-start gap-3 p-3.5 pr-2.5 shadow-[var(--shadow-pop)]"
              role="status"
            >
              <span className="mt-0.5 shrink-0">{ICONS[toast.type]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{toast.title}</p>
                {toast.message && <p className="mt-0.5 break-words text-xs leading-relaxed text-ink-soft">{toast.message}</p>}
              </div>
              <button
                aria-label="Dismiss"
                onClick={() => dismiss(toast.id)}
                className="rounded-md p-1 text-ink-soft transition-colors hover:bg-surface hover:text-ink"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
