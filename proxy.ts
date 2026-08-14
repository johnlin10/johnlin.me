import createIntlMiddleware from 'next-intl/middleware'
import { NextResponse, NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { routing } from './i18n/routing'

// next-intl 語系處理（保留原行為）。next-intl 目前仍只提供
// `next-intl/middleware` 這個進入點，Next 16 改名為 proxy 之後檔案位置變了、
// 匯入路徑沒變，所以這裡的識別字沿用 intlMiddleware。
const intlMiddleware = createIntlMiddleware(routing)

// 比對開頭的語系前綴（/en 或 /zh-tw），用來還原/組回帶前綴的路徑。
const LOCALE_PREFIX = /^\/(en|zh-tw)(?=\/|$)/

// Accept-Language 裡權重最高的語言標籤是否為中文（不分繁簡：zh、zh-TW、zh-CN、zh-Hans...）。
function isTopLanguageChinese(acceptLanguage: string | null) {
  if (!acceptLanguage) return false
  const top = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, qPart] = part.trim().split(';q=')
      return { tag: tag.trim(), q: qPart ? parseFloat(qPart) : 1 }
    })
    .filter((entry) => entry.tag)
    .sort((a, b) => b.q - a.q)[0]
  return /^zh\b/i.test(top?.tag ?? '')
}

/**
 * next-intl 只支援 en / zh-tw 兩個 locale，它內建的 Accept-Language 比對
 * 是嚴格 BCP-47 lookup，碰到 zh-CN、fr、ja 這類不在名單裡的標籤時規則不
 * 直覺（可能誤配到列表裡的下一個語言，或直接退回 defaultLocale），不是
 * 我們要的「非中文一律英文」二分法。所以在沒有 NEXT_LOCALE cookie 時，
 * 自己解析 Accept-Language 最高權重的語言，改寫成 'zh-tw' 或 'en' 這種
 * 能被 next-intl 精準比對的值再丟進去；cookie 存在時完全不動，判斷優先
 * 序本來就是 cookie > Accept-Language。
 */
function normalizeAcceptLanguage(request: NextRequest) {
  if (request.cookies.has('NEXT_LOCALE')) return request
  const preferred = isTopLanguageChinese(request.headers.get('accept-language'))
    ? 'zh-tw'
    : 'en'
  const headers = new Headers(request.headers)
  headers.set('accept-language', preferred)
  return new NextRequest(request, { headers })
}

/**
 * Proxy（Next 16 前稱 middleware）：先跑 next-intl，再對 /admin 路徑做
 * 伺服器端守衛。proxy 只能跑 Node.js runtime，不支援 edge，也不能設 runtime。
 * 公開頁完全不碰 Supabase，保持快速；只有後台會付出 getUser + is_admin 的成本。
 * 真正的資料安全底線是 RLS，這裡只是提前把未授權者導回登入頁。
 */
export default async function proxy(request: NextRequest) {
  const response = intlMiddleware(normalizeAcceptLanguage(request))

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
