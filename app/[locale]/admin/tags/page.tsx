import { createClient } from '@/app/lib/supabase/server'
import { getTags } from '@/app/lib/supabase/tags'
import TagsTool from './TagsTool'

/**
 * 標籤管理。首屏資料在伺服器端抓，function 跟 Supabase 同在東京。
 */
export default async function TagsPage() {
  const initial = await getTags(await createClient()).catch(() => null)
  return <TagsTool initial={initial} />
}
