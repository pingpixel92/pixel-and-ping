'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'

/**
 * Lightweight SVG charts — no chart library, animated once on reveal.
 * All inputs are real backend series; empty data renders an explicit empty hint.
 */

export interface SeriesPoint {
  t: string
  a: number
  b?: number
}

function niceMax(max: number): number {
  if (max <= 0) return 1
  const exp = Math.floor(Math.log10(max))
  const base = 10 ** exp
  return Math.ceil(max / base) * base
}

export function AreaChart({
  series,
  height = 200,
  labelA = 'Series A',
  labelB,
  formatValue,
}: {
  series: SeriesPoint[]
  height?: number
  labelA: string
  labelB?: string
  formatValue?: (v: number) => string
}) {
  const reduced = useReducedMotion()
  const W = 640
  const H = height
  const PAD = { top: 14, right: 8, bottom: 22, left: 8 }

  const { pathA, pathB, areaA, ticks, hasData } = useMemo(() => {
    if (series.length === 0) return { pathA: '', pathB: '', areaA: '', ticks: [] as Array<{ y: number; v: number }>, hasData: false }
    const maxVal = niceMax(Math.max(...series.map((p) => Math.max(p.a, p.b ?? 0))))
    const innerW = W - PAD.left - PAD.right
    const innerH = H - PAD.top - PAD.bottom
    const x = (i: number) => PAD.left + (series.length === 1 ? innerW / 2 : (i / (series.length - 1)) * innerW)
    const y = (v: number) => PAD.top + innerH - (v / maxVal) * innerH

    const line = (get: (p: SeriesPoint) => number) =>
      series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(get(p)).toFixed(1)}`).join(' ')

    const pa = line((p) => p.a)
    const pb = labelB ? line((p) => p.b ?? 0) : ''
    const aa = `${pa} L${x(series.length - 1).toFixed(1)},${(H - PAD.bottom).toFixed(1)} L${x(0).toFixed(1)},${(H - PAD.bottom).toFixed(1)} Z`

    const tickCount = 4
    const tks = Array.from({ length: tickCount + 1 }, (_, i) => ({
      y: PAD.top + innerH - (i / tickCount) * innerH,
      v: (i / tickCount) * maxVal,
    }))
    return { pathA: pa, pathB: pb, areaA: aa, ticks: tks, hasData: true }
  }, [series, H, labelB, PAD.bottom, PAD.left, PAD.right, PAD.top])

  if (!hasData) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-ink-soft" role="img" aria-label="Chart with no data">
        No data for this range yet.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-4 rounded-full bg-brand" /> {labelA}
        </span>
        {labelB && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-full bg-brand-light" /> {labelB}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${labelA} chart`}>
        {ticks.map((tick, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={tick.y} y2={tick.y} stroke="var(--hairline)" strokeWidth="1" />
            {i > 0 && (
              <text x={PAD.left + 4} y={tick.y - 4} fontSize="9" fill="var(--ink-soft)">
                {formatValue ? formatValue(tick.v) : Math.round(tick.v)}
              </text>
            )}
          </g>
        ))}
        <motion.path
          d={areaA}
          fill="url(#pp-area-gradient)"
          initial={reduced ? undefined : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7 }}
        />
        <motion.path
          d={pathA}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="2"
          strokeLinecap="round"
          initial={reduced ? undefined : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: reduced ? 0 : 0.9, ease: 'easeOut' }}
        />
        {pathB && (
          <motion.path
            d={pathB}
            fill="none"
            stroke="var(--brand-light)"
            strokeWidth="2"
            strokeDasharray="5 4"
            strokeLinecap="round"
            initial={reduced ? undefined : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: reduced ? 0 : 1.1, ease: 'easeOut' }}
          />
        )}
        <defs>
          <linearGradient id="pp-area-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.01" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

export function BarChart({
  data,
  formatValue,
}: {
  data: Array<{ label: string; value: number }>
  formatValue?: (v: number) => string
}) {
  const reduced = useReducedMotion()
  if (data.length === 0) {
    return <div className="flex h-40 items-center justify-center text-sm text-ink-soft">No data for this range yet.</div>
  }
  const max = niceMax(Math.max(...data.map((d) => d.value)))
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-xs text-ink-soft" title={d.label}>
            {d.label}
          </span>
          <div className="h-5 flex-1 overflow-hidden rounded-md bg-surface">
            <motion.div
              className="flex h-full items-center justify-end rounded-md bg-brand pr-2"
              initial={reduced ? { width: `${(d.value / max) * 100}%` } : { width: 0 }}
              animate={{ width: `${Math.max(d.value > 0 ? 6 : 0, (d.value / max) * 100)}%` }}
              transition={{ duration: reduced ? 0 : 0.6, ease: 'easeOut', delay: i * 0.05 }}
            >
              <span className="num text-[10px] font-semibold text-white">{formatValue ? formatValue(d.value) : d.value}</span>
            </motion.div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function Sparkline({ values, tone = 'brand' }: { values: number[]; tone?: 'brand' | 'teal' }) {
  if (values.length === 0) {
    return <div className="h-9 w-24 rounded bg-surface" aria-hidden />
  }
  const max = Math.max(...values, 1)
  const W = 96
  const H = 36
  const path = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${((i / (values.length - 1)) * W).toFixed(1)},${(H - (v / max) * (H - 4) - 2).toFixed(1)}`)
    .join(' ')
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden className="shrink-0">
      <path d={path} fill="none" stroke={tone === 'brand' ? 'var(--brand)' : 'var(--accent-teal)'} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
