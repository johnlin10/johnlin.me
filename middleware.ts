import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

// 全站開放：僅保留 next-intl 的語系中介層。
// （建設中鎖定、寫死短網址、強制導回原網域等邏輯已於 2026-07 移除；
//  未來的短網址功能將以獨立模組實作。）
export default createMiddleware(routing)

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
}
