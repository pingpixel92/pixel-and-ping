'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { springSoft } from './reveal'
import { Button } from './ui-primitives'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  width?: number
  dangerous?: boolean
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/** Spring modal with backdrop blur, focus trap, Escape close, ARIA. */
export function Modal({ open, onClose, title, description, children, footer, width = 520, dangerous }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'Tab' && panel) {
        const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.hasAttribute('disabled'))
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previouslyFocused?.focus?.()
    }
  }, [open, onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
        >
          <motion.div
            className="absolute inset-0 bg-navy-900/45 backdrop-blur-[3px]"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.15 } }}
            transition={springSoft}
            className="card relative max-h-[88vh] w-full overflow-y-auto p-6 shadow-[var(--shadow-pop)]"
            style={{ maxWidth: width }}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className={`text-base font-semibold ${dangerous ? 'text-danger' : 'text-ink'}`}>{title}</h2>
                {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
              </div>
              <button
                aria-label="Close dialog"
                onClick={onClose}
                className="rounded-lg p-1.5 text-ink-soft transition-colors hover:bg-surface hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
            <div>{children}</div>
            {footer && <div className="mt-6 flex flex-wrap items-center justify-end gap-2">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Delete',
  loading,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  loading?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      dangerous
      width={440}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="rounded-xl border border-[rgba(220,38,38,0.15)] bg-[rgba(220,38,38,0.04)] p-3.5 text-sm text-ink">
        This action is permanent and cannot be undone.
      </div>
    </Modal>
  )
}
