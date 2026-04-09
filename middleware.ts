import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { NextRequest, NextResponse } from 'next/server'

const intlMiddleware = createMiddleware(routing)

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get('host') || ''

  const isLocalhost = host.includes('localhost')
  const isTargetHost = host === 'johnlin.me'

  // 將非 localhost 和非原始網域的請求，導向 johnlin.me
  if (!isLocalhost && !isTargetHost) {
    return NextResponse.redirect(`https://johnlin.me/`)
  }

  // 只允許訪問首頁路由，其他全部導向首頁
  const isRootPath = pathname === '/'
  const isLocalePath = routing.locales.some((locale) => pathname === `/${locale}`)
  
  if (!isRootPath && !isLocalePath) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
}
