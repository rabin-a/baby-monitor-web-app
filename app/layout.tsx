import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import Script from 'next/script'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: 'Free Baby Monitor Online - No App Needed | babymonitor.online',
    template: '%s | Baby Monitor',
  },
  description: 'Free online baby monitor that works in your browser. Turn any old phone into a baby monitor — no app to install, no account needed, no payment. Audio streams securely peer-to-peer using WebRTC encryption.',
  metadataBase: new URL('https://babymonitor.online'),
  applicationName: 'Baby Monitor',
  keywords: [
    'baby monitor',
    'free baby monitor',
    'online baby monitor',
    'baby monitor app',
    'browser baby monitor',
    'wifi baby monitor',
    'baby monitor no app',
    'baby monitor free online',
    'old phone baby monitor',
    'webrtc baby monitor',
    'privacy baby monitor',
    'peer to peer baby monitor',
    'baby monitor without account',
    'baby monitor no subscription',
    'audio baby monitor',
    'baby monitor web app',
  ],
  authors: [{ name: 'babymonitor.online' }],
  creator: 'babymonitor.online',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Baby Monitor',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'Free Baby Monitor Online - No App Needed',
    description: 'Turn any old phone into a baby monitor. Free, private, no app to install. Audio streams directly between your devices — never stored on any server.',
    url: 'https://babymonitor.online',
    siteName: 'Baby Monitor',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Baby Monitor - Free online baby monitor',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Baby Monitor Online - No App Needed',
    description: 'Turn any old phone into a baby monitor. Free, private, no app to install.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: 'https://babymonitor.online',
  },
  category: 'utilities',
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

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Baby Monitor',
  url: 'https://babymonitor.online',
  description: 'Free online baby monitor that works in your browser. Turn any old phone into a baby monitor with peer-to-peer audio streaming.',
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Any',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  featureList: [
    'Free to use',
    'No app installation required',
    'No account or signup needed',
    'End-to-end encrypted audio',
    'Works on any device with a browser',
    'Privacy-first — audio never stored on servers',
    'Real-time audio level visualization',
    'QR code for easy device pairing',
  ],
  browserRequirements: 'Requires a modern browser with WebRTC support',
  softwareVersion: '1.0',
  creator: {
    '@type': 'Organization',
    name: 'babymonitor.online',
    url: 'https://babymonitor.online',
  },
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is this baby monitor really free?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, babymonitor.online is completely free to use. No payment, no subscription, no hidden fees. It runs entirely in your browser.',
      },
    },
    {
      '@type': 'Question',
      name: 'Do I need to install an app?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. Baby Monitor works directly in your web browser on any device — phone, tablet, or computer. No app download needed. You can also install it as a PWA from your browser for an app-like experience.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is the audio recording stored anywhere?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. Audio streams directly between your two devices using WebRTC peer-to-peer encryption. No audio ever touches or is stored on any server. We have no ability to listen to or record your audio.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I use my old phone as a baby monitor?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes! That is exactly what Baby Monitor is designed for. Place your old phone near the baby, open babymonitor.online, and start monitoring. Then scan the QR code with your current phone to listen.',
      },
    },
    {
      '@type': 'Question',
      name: 'Do both devices need to be on the same WiFi?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. Baby Monitor works on any network. You can choose "Same network" mode for extra security (only devices on your WiFi can connect) or "Any network" mode to monitor from anywhere.',
      },
    },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#009FC1" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
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
