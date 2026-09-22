'use client'

interface LogoProps {
  size?: number
  withWordmark?: boolean
  tone?: 'light' | 'dark'
  className?: string
}

/**
 * Pixel & Ping mark: a pixel grid + radar ping signal.
 * Pure SVG/CSS — works in sidebar, login, loader, mobile header, favicon.
 */
export function Logo({ size = 30, withWordmark = false, tone = 'dark', className }: LogoProps) {
  const textColor = tone === 'light' ? '#ffffff' : '#0a0a0a'
  const softColor = tone === 'light' ? 'rgba(255,255,255,0.62)' : '#717784'
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
        <rect width="64" height="64" rx="14" fill="#071a36" />
        <g>
          <rect x="12" y="38" width="12" height="12" rx="3" fill="#2563c9" />
          <rect x="12" y="24" width="12" height="12" rx="3" fill="#5790e6" />
          <rect x="26" y="38" width="12" height="12" rx="3" fill="#0b6e97" />
        </g>
        <g fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round">
          <path d="M40 24a12 12 0 0 1 12 12" opacity="0.45" />
          <path d="M40 17a19 19 0 0 1 19 19" opacity="0.25" />
        </g>
        <circle cx="40" cy="36" r="4.5" fill="#ffffff" />
      </svg>
      {withWordmark && (
        <span className="leading-tight">
          <span className="block font-semibold tracking-tight" style={{ fontSize: size * 0.52, color: textColor }}>
            Pixel &amp; Ping
          </span>
          <span className="block" style={{ fontSize: size * 0.28, color: softColor, letterSpacing: '0.14em' }}>
            INFRASTRUCTURE PANEL
          </span>
        </span>
      )}
    </span>
  )
}
