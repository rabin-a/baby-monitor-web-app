import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Baby Monitor - Privacy-First Audio Streaming',
  description: 'Privacy-first baby monitor using WebRTC for secure peer-to-peer audio streaming. No accounts, no tracking, no audio stored on servers.',
  metadataBase: new URL('https://babymonitor.online'),
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
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
