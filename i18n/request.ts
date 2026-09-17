import { getRequestConfig } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale

  return {
    locale,
    // 沒設的話會用 server 的時區，Vercel 是 UTC，client 的 format.dateTime 也跟著用 UTC
    timeZone: 'Asia/Taipei',
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
