import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'

/**
 * OAuth 回呼：Google 登入後帶著 ?code 導回這裡，
 * 交換成 session（寫入 cookie）後導回後台首頁，語系交給 proxy 依 cookie 決定。
 * 刻意不收 ?next：少一個參數就少一個 open redirect 的入口。
 */
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return redirectTo('/')
    }
  }

  return redirectTo('/login?error=auth')
}

/**
 * 以相對路徑轉址，由瀏覽器依實際造訪的網域解析。
 * 不用 request.url 組絕對網址：本機開發時它是 localhost:3000，
 * 不是瀏覽器所在的 admin.localhost:3000。
 * @param path 站內固定路徑，不可接受外部輸入
 * @returns 307 轉址回應
 */
function redirectTo(path: string) {
  return new NextResponse(null, { status: 307, headers: { Location: path } })
}
