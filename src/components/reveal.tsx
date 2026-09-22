'use client'

import { motion, type Transition, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

export const spring: Transition = { type: 'spring', stiffness: 300, damping: 28 }
export const springSoft: Transition = { type: 'spring', stiffness: 200, damping: 26 }
export const easeOut: Transition = { duration: 0.38, ease: [0.22, 0.61, 0.36, 1] }

interface RevealProps {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
  once?: boolean
}

/** Fade + rise reveal (Baseline motion language). Respects reduced motion. */
export function Reveal({ children, delay = 0, y = 14, className, once = true }: RevealProps) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-32px' }}
      transition={reduced ? { duration: 0.15, delay } : { ...easeOut, delay }}
    >
      {children}
    </motion.div>
  )
}

interface StaggerProps {
  children: ReactNode
  className?: string
  step?: number
}

/** Staggered list container — children should be plain elements or motion items. */
export function Stagger({ children, className, step = 0.05 }: StaggerProps) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: reduced ? 0 : step } },
      }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      className={className}
      variants={{
        hidden: reduced ? { opacity: 0 } : { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: easeOut },
      }}
    >
      {children}
    </motion.div>
  )
}

/** Number emphasis: fade + small rise when value changes. */
export function AnimatedValue({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()
  return (
    <motion.span
      key={String(children)}
      initial={reduced ? { opacity: 0.4 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0.1 } : easeOut}
      style={{ display: 'inline-block' }}
    >
      {children}
    </motion.span>
  )
}

/** Page transition wrapper — short fade/slide only (dashboard-grade pacing). */
export function PageTransition({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0.12 : 0.28, ease: [0.22, 0.61, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
