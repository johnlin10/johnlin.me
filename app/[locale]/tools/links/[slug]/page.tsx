import { createClient } from '@/app/lib/supabase/server'
import { getClicks, getShortLink } from '@/app/lib/supabase/shortLinks'
import { STATS_DAYS } from '@/app/lib/shortLinks'
import LinkDetail from './LinkDetail'

/**
 * 單一短網址的點擊統計。資料在伺服器端抓，function 跟 Supabase 同在東京。
 */
export default async function ShortLinkDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const initial = await Promise.all([getShortLink(supabase, slug), getClicks(supabase, slug, STATS_DAYS)])
    .then(([link, clicks]) => ({ link, clicks }))
    .catch(() => null)
  return <LinkDetail initial={initial} />
}
