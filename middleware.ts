import createIntlMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { routing } from './i18n/routing'

// next-intl 語系中介層（保留原行為）。
const intlMiddleware = createIntlMiddleware(routing)

// 比對開頭的語系前綴（/en 或 /zh-tw），用來還原/組回帶前綴的路徑。
const LOCALE_PREFIX = /^\/(en|zh-tw)(?=\/|$)/

/**
 * 中介層：先跑 next-intl，再對 /admin 路徑做伺服器端守衛。
 * 公開頁完全不碰 Supabase，保持快速；只有後台會付出 getUser + is_admin 的成本。
 * 真正的資料安全底線是 RLS，這裡只是提前把未授權者導回登入頁。
 */
export default async function middleware(request: NextRequest) {
  const response = intlMiddleware(request)

  const { pathname } = request.nextUrl
  const stripped = pathname.replace(LOCALE_PREFIX, '') || '/'
  const isAdminPath = stripped === '/admin' || stripped.startsWith('/admin/')
  const isLoginPath = stripped === '/admin/login'

  if (isAdminPath && !isLoginPath) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    let allowed = false
    if (user) {
      const { data } = await supabase.rpc('is_admin')
      allowed = data === true
    }

    if (!allowed) {
      const prefix = pathname.match(LOCALE_PREFIX)?.[0] ?? ''
      return NextResponse.redirect(
        new URL(`${prefix}/admin/login`, request.url)
      )
    }
  }

  return response
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|auth|.*\\..*).*)',
}
