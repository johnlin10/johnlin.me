import { createClient } from '@supabase/supabase-js'

/**
 * 公開讀取用的 Supabase client：匿名金鑰、不帶 cookie / 不維持 session。
 * 專供「只讀公開已發布資料」的場景（首頁、列表），RLS 下等同匿名 → 只回 published。
 *
 * 為什麼不用 server.ts 的 client：那個綁 cookie，會讓頁面被迫動態渲染；
 * 這個無 cookie，可安全放進 unstable_cache 做跨請求快取。
 */
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
