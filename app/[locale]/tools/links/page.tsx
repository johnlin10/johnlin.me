import { createClient } from '@/app/lib/supabase/server'
import { getShortLinks } from '@/app/lib/supabase/shortLinks'
import LinksTool from './LinksTool'

/**
 * 短網址列表。首屏資料在伺服器端抓，function 跟 Supabase 同在東京。
 */
export default async function LinksPage() {
  const initial = await getShortLinks(await createClient()).catch(() => null)
  return <LinksTool initial={initial} />
}
