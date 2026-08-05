import { createBrowserClient } from '@supabase/ssr'

/**
 * 瀏覽器端 Supabase client（用於 client component：登入、CMS 互動）。
 * 每次呼叫回傳新實例；在 client component 裡以 useMemo/useState 快取即可。
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
