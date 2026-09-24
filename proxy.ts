import createIntlMiddleware from 'next-intl/middleware'
import { NextResponse, NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { routing } from './i18n/routing'
import { SITE_CONFIG, isGoHost, subdomainOf } from './app/lib/siteConfigs'
import { createPublicClient } from './app/lib/supabase/public'
import { authCookieOptions, isLegacyAuthCookie } from './app/lib/supabase/authCookie'

// next-intl 語系處理。next-intl 目前仍只提供
// `next-intl/middleware` 這個進入點，Next 16 改名為 proxy 之後檔案位置變了、
// 匯入路徑沒變，所以這裡的識別字沿用 intlMiddleware。
const intlMiddleware = createIntlMiddleware(routing)

// 比對開頭的語系前綴（/en 或 /zh-tw），用來還原/組回帶前綴的路徑。
const LOCALE_PREFIX = /^\/(en|zh-tw)(?=\/|$)/

const SUBDOMAIN_PATH = /^\/(studio|tools)(?=\/|$)/

type CookieToSet = { name: string; value: string; options: CookieOptions }

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

// 機器人 UA。這些請求不代表真人的語言偏好——User-Agent 幾乎都寫死、
// 跟分享者實際使用的瀏覽器語言無關；如果讓它們也吃 Accept-Language 判斷：
// 分享 https://johnlin.me（無前綴）時會被爬蟲自己的 Accept-Language 導去
// /en，抓回英文標題/描述/OG 圖，跟使用者實際貼出去的網址對不上；搜尋引擎
// 則會把 sitemap 裡的每一條 zh 正規網址都看成轉址，索引不到。
//
// 用 bot/crawler/spider/slurp 這幾個通用字眼涵蓋，不逐一列舉——爬蟲列不完，
// 而真人瀏覽器的 UA 不會出現這些字。bot 後面要 \b 才不會漏掉 Googlebot-Image
// 這種帶後綴的。其餘是 UA 不含通用字眼的社群爬蟲，只能列名。
const BOT = /bot\b|crawler|spider|slurp|facebookexternalhit|WhatsApp|SkypeUriPreview|Pinterest/i

/**
 * 語系判斷優先序：網址前綴 > NEXT_LOCALE cookie（使用者用 LanguageSwitch
 * 明確切換過，或先前被下面這段自動導向過） > Accept-Language。
 * 真人瀏覽器：預設中文，Accept-Language 最高權重語言非中文（不分繁簡）就
 * 自動導去 /en，next-intl 會順便把選擇寫回 NEXT_LOCALE cookie，效果等同
 * 使用者手動切換過一次。
 * 爬蟲：只看網址是否已經帶 /en，完全不採信它自己的 Accept-Language，避免
 * 分享出去的網址跟抓回來的語言對不上，也讓 sitemap 的 zh 網址直接回 200。
 */
function normalizeAcceptLanguage(request: NextRequest) {
  if (request.cookies.has('NEXT_LOCALE')) return request

  const isBot = BOT.test(request.headers.get('user-agent') ?? '')
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
 * 目前登入者是否為管理員（is_admin RPC）。
 * 不另外 getUser：PostgREST 會先驗 JWT，跟 RLS 的判斷一致；proxy 離 Supabase 遠，少一趟約省 150ms。
 * @param request 進來的請求，從這裡讀 Supabase session cookie；session 換新時也寫回這裡，頁面在伺服器端才讀得到新的
 * @param refreshed 換新的 cookie 收在這裡，之後寫進回應
 * @returns 已登入且為管理員才回 true
 */
async function isAdmin(request: NextRequest, refreshed: CookieToSet[]) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: authCookieOptions(request.headers.get('host')),
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          refreshed.push(...cookiesToSet)
        },
      },
    },
  )

  const { data } = await supabase.rpc('is_admin')
  return data === true
}

/**
 * 從 Referer 取出網域，完整網址可能帶查詢字串，不存。
 * @param referer Referer 標頭
 * @returns 網域；沒有或解析失敗回 null
 */
function refererHost(referer: string | null) {
  try {
    return referer ? new URL(referer).host : null
  } catch {
    return null
  }
}

/**
 * 短網址不存在時的 404 頁，不經過 Next 的頁面。
 * @returns 404 回應
 */
function shortLinkNotFound() {
  const home = SITE_CONFIG.url.replace(/^https?:\/\//, '')
  return new NextResponse(
    `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404</title><style>body{margin:0;min-height:100vh;display:grid;place-content:center;text-align:center;font:16px/1.8 system-ui,sans-serif;background:#faf6ee;color:#201b13}a{color:oklch(0.62 0.15 52)}@media(prefers-color-scheme:dark){body{background:#14110d;color:#ede4d3}}</style><p>找不到這個短網址 · Short link not found</p><p><a href="${SITE_CONFIG.url}">${home}</a></p></html>`,
    { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } },
  )
}

/**
 * go 子網域：路徑就是 slug，查到就 307 轉過去，連結預覽爬蟲照轉但不記點擊。
 * 用 307 不用 301，瀏覽器不會永久快取，改了目標網址馬上生效。
 * @param request 進來的請求
 * @returns 轉址或 404
 */
async function redirectShortLink(request: NextRequest) {
  const slug = request.nextUrl.pathname.slice(1).toLowerCase()
  if (!slug) return NextResponse.redirect(SITE_CONFIG.url, 307)

  const { data: target, error } = await createPublicClient().rpc('resolve_short_link', {
    p_slug: slug,
    p_referrer_host: refererHost(request.headers.get('referer')),
    p_country: request.headers.get('x-vercel-ip-country'),
    p_log:
      request.method === 'GET' &&
      !BOT.test(request.headers.get('user-agent') ?? ''),
  })
  if (error) console.error('resolve_short_link 失敗:', error)

  return typeof target === 'string'
    ? NextResponse.redirect(target, 307)
    : shortLinkNotFound()
}

/**
 * Proxy（Next 16 前稱 middleware）：依 Host 分成主站、子網域（後台、工具）和短網址。
 * proxy 只能跑 Node.js runtime，不支援 edge，也不能設 runtime。
 * - 短網址（go.）：不跑 next-intl，直接查 slug 轉址。
 * - 主站：只跑 next-intl，完全不碰 Supabase。/studio、/tools 回 404，不轉址到子網域——
 *   轉址等於把位置告訴對方。
 * - 子網域：語系沿用主站同一套 next-intl 規則，再把 /posts 對應到
 *   app/[locale]/<子網域>/posts；除了 /login 都要通過 is_admin。
 * 真正的資料安全底線是 RLS，這裡只是提前把未授權者導回登入頁。
 */
export default async function proxy(request: NextRequest) {
  if (isGoHost(request.headers.get('host'))) return redirectShortLink(request)

  const { pathname, search } = request.nextUrl
  const prefix = pathname.match(LOCALE_PREFIX)?.[0] ?? ''
  const stripped = pathname.slice(prefix.length) || '/'
  const locale = prefix.slice(1) || routing.defaultLocale
  const app = subdomainOf(request.headers.get('host'))

  if (!app) {
    if (SUBDOMAIN_PATH.test(stripped)) {
      // 沒有 /404 這個路由，落到 [...rest]，跟其他不存在的網址回一樣的 404。
      return NextResponse.rewrite(new URL(`/${locale}/404`, request.url))
    }
    return intlMiddleware(normalizeAcceptLanguage(request))
  }

  // next-intl 要轉址（/zh-tw/x → /x、依 cookie／Accept-Language 導去 /en/x）就照轉，
  // 轉址目標本來就是子網域上看得到的網址。
  const intlResponse = intlMiddleware(normalizeAcceptLanguage(request))
  if (intlResponse.headers.has('location')) return intlResponse

  const refreshed: CookieToSet[] = []
  if (stripped !== '/login' && !(await isAdmin(request, refreshed))) {
    return NextResponse.redirect(new URL(`${prefix}/login`, request.url))
  }

  // 沒轉址代表語系已定：有前綴就是前綴的語系，沒前綴就是預設語系（as-needed）。
  // headers 要在 isAdmin 之後才複製，才帶得到換新的 session cookie
  const headers = new Headers(request.headers)
  headers.set('X-NEXT-INTL-LOCALE', locale)
  const response = NextResponse.rewrite(
    new URL(`/${locale}/${app}${stripped === '/' ? '' : stripped}${search}`, request.url),
    { request: { headers } },
  )
  intlResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
  refreshed.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
  // ponytail: 清掉改名前只寫在子網域自己身上的登入 cookie，各裝置都開過 studio、tools 一次後就能刪
  request.cookies
    .getAll()
    .filter(({ name }) => isLegacyAuthCookie(name))
    .forEach(({ name }) => response.cookies.delete(name))

  return response
}

export const config = {
  // 知識庫分享頁的路徑是筆記名稱，檔名帶點（「1.2 定義」）也要拿到語系
  matcher: ['/((?!api|trpc|_next|_vercel|auth|.*\\..*).*)', '/kb/:path*', '/en/kb/:path*'],
}
