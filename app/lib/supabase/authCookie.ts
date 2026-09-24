import { SITE_CONFIG } from '@/app/lib/siteConfigs'

const SITE_HOST = new URL(SITE_CONFIG.url).hostname

// 改過名：舊名是 Supabase 預設的 sb-<ref>-auth-token，只寫在各子網域自己身上
const AUTH_COOKIE = 'sb-johnlin-auth'

/**
 * 登入 cookie 的設定。在正式網域底下發給整個 .johnlin.me，studio 和 tools 共用同一個登入；
 * localhost 和 Vercel 預覽網址不設網域，瀏覽器不收 .localhost 這種網域。
 * @param host 目前的 Host（可帶 port）
 * @returns 傳給 Supabase client 的 cookieOptions
 */
export function authCookieOptions(host: string | null | undefined) {
  const hostname = host?.split(':')[0] ?? ''
  const shared = hostname === SITE_HOST || hostname.endsWith(`.${SITE_HOST}`)
  return { name: AUTH_COOKIE, ...(shared && { domain: `.${SITE_HOST}` }) }
}

/**
 * 是否為改名前的登入 cookie（含分段的 .0、.1 和 code-verifier）。
 * @param name cookie 名稱
 * @returns 是舊的就回 true
 */
export function isLegacyAuthCookie(name: string) {
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]
  return name.startsWith(`sb-${ref}-auth-token`)
}
