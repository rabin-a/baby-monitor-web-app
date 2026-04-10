import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import Script from 'next/script'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Baby Monitor - Privacy-First Audio Streaming',
  description: 'Privacy-first baby monitor using WebRTC for secure peer-to-peer audio streaming. No accounts, no tracking, no audio stored on servers.',
  metadataBase: new URL('https://babymonitor.online'),
  applicationName: 'Baby Monitor',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Baby Monitor',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'Baby Monitor',
    description: 'Privacy-first peer-to-peer audio baby monitor. No accounts needed.',
    url: 'https://babymonitor.online',
    siteName: 'Baby Monitor',
    type: 'website',
  },
  generator: 'v0, Claude Code',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#7C3AED" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="icon" href="/icon-light-32x32.png" sizes="32x32" type="image/png" />
      </head>
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && (
          <>
            <Analytics />
            <Script
              defer
              src="https://static.cloudflareinsights.com/beacon.min.js"
              data-cf-beacon='{"token": "0c4e7758a02b476e81721f65443e6061"}'
              strategy="afterInteractive"
            />
          </>
        )}
      </body>
    </html>
  )
}
