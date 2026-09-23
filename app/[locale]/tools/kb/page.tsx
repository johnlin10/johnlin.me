import { createClient } from '@/app/lib/supabase/server'
import { getKbNotes, getKbShareLinks, getKnowledgeFolders } from '@/app/lib/supabase/kb'
import KbTool from './KbTool'

/**
 * 知識庫：上傳 Obsidian 資料夾、管理分享連結和知識資料夾。首屏資料在伺服器端抓。
 */
export default async function KbPage() {
  const supabase = await createClient()
  const initial = await Promise.all([
    getKbNotes(supabase),
    getKbShareLinks(supabase),
    getKnowledgeFolders(supabase),
  ])
    .then(([notes, shares, knowledge]) => ({ notes, shares, knowledge }))
    .catch(() => null)
  return <KbTool initial={initial} />
}
