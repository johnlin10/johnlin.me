import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'

/**
 * OAuth 回呼：Google 登入後帶著 ?code 導回這裡，
 * 交換成 session（寫入 cookie）後導向 next（預設後台）。
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/admin'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/admin/login?error=auth`)
}
