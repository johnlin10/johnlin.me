import { createClient } from '@/app/lib/supabase/server'
import { getKbNotes } from '@/app/lib/supabase/kb'
import KbTool from './KbTool'

/**
 * 知識庫：上傳 Obsidian 資料夾、看目前有哪些筆記。首屏清單在伺服器端抓。
 */
export default async function KbPage() {
  const initial = await getKbNotes(await createClient()).catch(() => null)
  return <KbTool initial={initial} />
}
