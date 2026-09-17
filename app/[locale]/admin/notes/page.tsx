import { createClient } from '@/app/lib/supabase/server'
import { getNotesForAdmin } from '@/app/lib/supabase/notes'
import NotesTool from './NotesTool'

/**
 * 短文管理。首屏資料在伺服器端抓，function 跟 Supabase 同在東京。
 */
export default async function AdminNotesPage() {
  const initial = await getNotesForAdmin(await createClient()).catch(() => null)
  return <NotesTool initial={initial} />
}
