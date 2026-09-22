import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/toast'
import { I18nProvider } from '@/lib/i18n'
import { BootSplash } from '@/components/boot-splash'

export const metadata: Metadata = {
  title: {
    default: 'Pixel & Ping — Infrastructure Panel',
    template: '%s · Pixel & Ping',
  },
  description: 'Professional infrastructure and network management panel: users, servers, endpoints, monitoring and more.',
  applicationName: 'Pixel & Ping',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#071a36',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Onest (400/500/600) + JetBrains Mono for technical values */}
        <link
          href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-background text-foreground">
        <I18nProvider>
          <ToastProvider>
            <BootSplash />
            {children}
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
