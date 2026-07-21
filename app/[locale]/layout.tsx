import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { Noto_Sans_TC } from 'next/font/google'
import { ThemeProvider } from '../contexts/ThemeContext'
import Header from '@/app/components/Header/Header'
import Footer from '@/app/components/Footer/Footer'

// i18n
import { routing } from '@/i18n/routing'
import { NextIntlClientProvider, hasLocale } from 'next-intl'

import { GoogleAnalytics } from '@next/third-parties/google'

const notoSansTC = Noto_Sans_TC({
  variable: '--font-noto-sans-tc',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'John Lin | 林昌龍',
  description: 'A web developer, photographer, and thinker.',
  icons: {
    icon: '/johnlin-logo-128-nb.png',
  },
}
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  userScalable: false,
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ locale: string }>
}>) {
  // i18n
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* 自架源起明體（GenKiMin TW）— unicode-range 分片，只載入頁面用到的字 */}
        <link rel="stylesheet" href="/fonts/genkimin/genkimin.css" />
      </head>
      <body className={`${notoSansTC.variable} antialiased`}>
        <GoogleAnalytics gaId="G-X5EXGR4ERD" />
        <NextIntlClientProvider locale={locale}>
          <ThemeProvider>
            <Header />
            <div className="site-main">{children}</div>
            <Footer />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
