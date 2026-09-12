import createIntlMiddleware from 'next-intl/middleware'
import { NextResponse, NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { routing } from './i18n/routing'
import { isAdminHost } from './app/lib/siteConfigs'

// next-intl 語系處理。next-intl 目前仍只提供
// `next-intl/middleware` 這個進入點，Next 16 改名為 proxy 之後檔案位置變了、
// 匯入路徑沒變，所以這裡的識別字沿用 intlMiddleware。
const intlMiddleware = createIntlMiddleware(routing)

// 比對開頭的語系前綴（/en 或 /zh-tw），用來還原/組回帶前綴的路徑。
const LOCALE_PREFIX = /^\/(en|zh-tw)(?=\/|$)/

const ADMIN_PATH = /^\/admin(?=\/|$)/

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

// 社群平台抓取連結預覽用的爬蟲 UA。這些請求不代表真人的語言偏好——
// User-Agent 幾乎都寫死、跟分享者實際使用的瀏覽器語言無關；如果讓它們
// 也吃 Accept-Language 判斷，分享 https://johnlin.me（無前綴）時常常會
// 被爬蟲自己的 Accept-Language 導去 /en，抓回英文標題/描述/OG 圖，跟
// 使用者實際貼出去的網址對不上。
const LINK_PREVIEW_BOT = /facebookexternalhit|Twitterbot|Slackbot|LinkedInBot|Discordbot|TelegramBot|WhatsApp|SkypeUriPreview|Pinterest|redditbot|Googlebot/i

/**
 * 語系判斷優先序：網址前綴 > NEXT_LOCALE cookie（使用者用 LanguageSwitch
 * 明確切換過，或先前被下面這段自動導向過） > Accept-Language。
 * 真人瀏覽器：預設中文，Accept-Language 最高權重語言非中文（不分繁簡）就
 * 自動導去 /en，next-intl 會順便把選擇寫回 NEXT_LOCALE cookie，效果等同
 * 使用者手動切換過一次。
 * 連結預覽爬蟲：只看網址是否已經帶 /en，完全不採信它自己的 Accept-Language，
 * 避免分享出去的網址跟抓回來的語言對不上。
 */
function normalizeAcceptLanguage(request: NextRequest) {
  if (request.cookies.has('NEXT_LOCALE')) return request

  const isBot = LINK_PREVIEW_BOT.test(request.headers.get('user-agent') ?? '')
  const preferred = isBot
    ? routing.defaultLocale
    : isTopLanguageChinese(request.headers.get('accept-language'))
      ? 'zh-tw'
      : 'en'

  const headers = new Headers(request.headers)
  headers.set('accept-language', preferred)
  return new NextRequest(request, { headers })
}

/**
 * 目前登入者是否為管理員（getUser + is_admin RPC）。
 * @param request 進來的請求，從這裡讀 Supabase session cookie
 * @param response 準備回傳的回應，session 換新時把 cookie 寫回這裡
 * @returns 已登入且為管理員才回 true
 */
async function isAdmin(request: NextRequest, response: NextResponse) {
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
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.rpc('is_admin')
  return data === true
}

/**
 * Proxy（Next 16 前稱 middleware）：依 Host 分成主站與後台子網域。
 * proxy 只能跑 Node.js runtime，不支援 edge，也不能設 runtime。
 * - 主站：只跑 next-intl，完全不碰 Supabase。/admin 回 404，不轉址到子網域——
 *   轉址等於把後台位置告訴對方。
 * - 後台子網域：語系沿用主站同一套 next-intl 規則，再把 /posts 對應到
 *   app/[locale]/admin/posts；除了 /login 都要通過 getUser + is_admin。
 * 真正的資料安全底線是 RLS，這裡只是提前把未授權者導回登入頁。
 */
export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const prefix = pathname.match(LOCALE_PREFIX)?.[0] ?? ''
  const stripped = pathname.slice(prefix.length) || '/'
  const locale = prefix.slice(1) || routing.defaultLocale

  if (!isAdminHost(request.headers.get('host'))) {
    if (ADMIN_PATH.test(stripped)) {
      // 沒有 /404 這個路由，落到 [...rest]，跟其他不存在的網址回一樣的 404。
      return NextResponse.rewrite(new URL(`/${locale}/404`, request.url))
    }
    return intlMiddleware(normalizeAcceptLanguage(request))
  }

  // next-intl 要轉址（/zh-tw/x → /x、依 cookie／Accept-Language 導去 /en/x）就照轉，
  // 轉址目標本來就是子網域上看得到的網址。
  const intlResponse = intlMiddleware(normalizeAcceptLanguage(request))
  if (intlResponse.headers.has('location')) return intlResponse

  // 沒轉址代表語系已定：有前綴就是前綴的語系，沒前綴就是預設語系（as-needed）。
  const headers = new Headers(request.headers)
  headers.set('X-NEXT-INTL-LOCALE', locale)
  const response = NextResponse.rewrite(
    new URL(`/${locale}/admin${stripped === '/' ? '' : stripped}${search}`, request.url),
    { request: { headers } },
  )
  intlResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))

  if (stripped !== '/login' && !(await isAdmin(request, response))) {
    return NextResponse.redirect(new URL(`${prefix}/login`, request.url))
  }

  return response
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|auth|.*\\..*).*)',
}
