import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Noto_Sans_TC } from 'next/font/google'
import { ThemeProvider } from '../contexts/ThemeContext'
import Header from '@/app/components/Header/Header'

// i18n
import { routing } from '@/i18n/routing'
import { NextIntlClientProvider, hasLocale } from 'next-intl'

// const geistSans = Geist({
//   variable: '--font-geist-sans',
//   subsets: ['latin'],
// })

// const geistMono = Geist_Mono({
//   variable: '--font-geist-mono',
//   subsets: ['latin'],
// })

const notoSansTC = Noto_Sans_TC({
  variable: '--font-noto-sans-tc',
  subsets: ['latin'],
})

const locales = ['zh-tw', 'en']

export const metadata: Metadata = {
  title: 'John Lin | 林昌龍',
  description: 'Web designer and developer.',
  icons: {
    icon: '/johnlin-logo-128-nb.png',
  },
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
      <body className={`${notoSansTC.variable} antialiased`}>
        <NextIntlClientProvider locale={locale}>
          <ThemeProvider>
            <Header />
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
