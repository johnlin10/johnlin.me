import type { SupabaseClient } from '@supabase/supabase-js'
import { randomSlug } from '@/app/lib/shortLinks'

export type ShortLink = {
  slug: string
  target_url: string
  note: string | null
  created_at: string
  clicks: number
  recent_clicks: number
}

export type Click = {
  clicked_at: string
  referrer_host: string | null
  country: string | null
}

type ShortLinkRow = Omit<ShortLink, 'clicks' | 'recent_clicks'> & {
  total: { count: number }[]
  recent?: { count: number }[]
}

const DAY = 86_400_000

/**
 * 某天數之前的時間點。
 * @param days 往回幾天
 * @returns ISO 字串
 */
function daysAgo(days: number) {
  return new Date(Date.now() - days * DAY).toISOString()
}

/**
 * 把 PostgREST 內嵌的 count 攤平成數字。
 * @param row 查詢結果的一列
 * @returns 短網址
 */
function toShortLink({ total, recent, ...link }: ShortLinkRow): ShortLink {
  return { ...link, clicks: total[0]?.count ?? 0, recent_clicks: recent?.[0]?.count ?? 0 }
}

/**
 * 全部短網址，新到舊，附總點擊和近 7 天點擊。
 * @param supabase Supabase client
 * @returns 短網址清單
 */
export async function getShortLinks(supabase: SupabaseClient): Promise<ShortLink[]> {
  const { data, error } = await supabase
    .from('short_links')
    .select(
      'slug, target_url, note, created_at, total:short_link_clicks(count), recent:short_link_clicks(count)',
    )
    .gte('recent.clicked_at', daysAgo(7))
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as ShortLinkRow[]).map(toShortLink)
}

/**
 * 單一短網址，附總點擊。
 * @param supabase Supabase client
 * @param slug 短網址 slug
 * @returns 短網址；不存在回 null
 */
export async function getShortLink(
  supabase: SupabaseClient,
  slug: string,
): Promise<ShortLink | null> {
  const { data, error } = await supabase
    .from('short_links')
    .select('slug, target_url, note, created_at, total:short_link_clicks(count)')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data ? toShortLink(data as ShortLinkRow) : null
}

/**
 * 某個短網址最近幾天的點擊明細，新到舊。
 * @param supabase Supabase client
 * @param slug 短網址 slug
 * @param days 往回幾天
 * @returns 點擊明細
 */
export async function getClicks(
  supabase: SupabaseClient,
  slug: string,
  days: number,
): Promise<Click[]> {
  // ponytail: 明細拉回瀏覽器再統計，一次最多 1000 筆；單一連結在這段期間破千再改成資料庫 group by
  const { data, error } = await supabase
    .from('short_link_clicks')
    .select('clicked_at, referrer_host, country')
    .eq('slug', slug)
    .gte('clicked_at', daysAgo(days))
    .order('clicked_at', { ascending: false })
    .limit(1000)
  if (error) throw error
  return data
}

/**
 * 新增短網址。沒給 slug 就隨機產生，撞到既有的就換一個，最多試三次。
 * @param supabase Supabase client
 * @param link 自訂 slug（null 表示隨機）、目標網址、備註
 * @returns 實際用到的 slug
 */
export async function createShortLink(
  supabase: SupabaseClient,
  link: { slug: string | null; target_url: string; note: string | null },
): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const slug = link.slug ?? randomSlug()
    const { error } = await supabase.from('short_links').insert({ ...link, slug })
    if (!error) return slug
    if (link.slug || error.code !== '23505' || attempt === 3) throw error
  }
}

/**
 * 修改目標網址和備註，slug 不能改。
 * @param supabase Supabase client
 * @param slug 短網址 slug
 * @param patch 目標網址、備註
 */
export async function updateShortLink(
  supabase: SupabaseClient,
  slug: string,
  patch: { target_url: string; note: string | null },
): Promise<void> {
  const { error } = await supabase.from('short_links').update(patch).eq('slug', slug)
  if (error) throw error
}

/**
 * 刪除短網址，點擊紀錄會跟著刪掉。
 * @param supabase Supabase client
 * @param slug 短網址 slug
 */
export async function deleteShortLink(supabase: SupabaseClient, slug: string): Promise<void> {
  const { error } = await supabase.from('short_links').delete().eq('slug', slug)
  if (error) throw error
}
