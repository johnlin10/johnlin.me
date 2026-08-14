import { createClient } from './server'

/**
 * Route handler 專用的管理員檢查。proxy.ts 的 matcher 明確排除了 `api`，
 * 所以任何 `app/api/**` route 都拿不到 proxy 的保護，得自己重複同一套
 * getUser() + is_admin RPC 檢查。
 */
export async function requireAdmin(): Promise<
  { ok: true } | { ok: false; status: 401 | 403 }
> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401 }

  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (isAdmin !== true) return { ok: false, status: 403 }

  return { ok: true }
}
