'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Logo } from './logo'

/** Short boot screen (600–1000ms) shown once per browser session. */
export function BootSplash() {
  const reduced = useReducedMotion()
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const seen = sessionStorage.getItem('pp_booted')
    if (seen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-mount sync (hydration-safe)
      setVisible(false)
      return
    }
    const duration = reduced ? 350 : 850
    const timer = setTimeout(() => {
      sessionStorage.setItem('pp_booted', '1')
      setVisible(false)
    }, duration)
    return () => clearTimeout(timer)
  }, [reduced])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white"
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          aria-hidden
        >
          <motion.div
            initial={reduced ? undefined : { opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
            className="flex flex-col items-center"
          >
            <Logo size={56} />
            <p className="mt-4 text-lg font-semibold tracking-tight text-ink">Pixel &amp; Ping</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-ink-soft">Infrastructure Panel</p>
            <div className="mt-7 h-[3px] w-44 overflow-hidden rounded-full bg-surface">
              <motion.div
                className="h-full rounded-full bg-brand"
                initial={reduced ? { width: '100%' } : { width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: reduced ? 0.2 : 0.7, ease: 'easeInOut' }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
