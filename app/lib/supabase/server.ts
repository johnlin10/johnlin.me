import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * 伺服器端 Supabase client（RSC / Route Handler / Server Action）。
 * 綁定 Next.js cookie，讓 RLS 依登入者 session 運作。
 *
 * 注意：在 RSC 中呼叫 setAll 會拋錯（RSC 不能寫 cookie），已 try/catch 吞掉；
 * session 的更新由 middleware 負責，所以 RSC 只讀不寫 cookie 是安全的。
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // 從 Server Component 呼叫時會落到這裡，可忽略（middleware 會刷新 session）。
          }
        },
      },
    }
  )
}
