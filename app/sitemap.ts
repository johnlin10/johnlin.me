import type { MetadataRoute } from 'next'
import { createPublicClient } from '@/app/lib/supabase/public'
import { getPublishedPosts } from '@/app/lib/supabase/posts'
import { getPublishedNotes } from '@/app/lib/supabase/notes'
import { SITE_CONFIG } from '@/app/lib/siteConfigs'

// 每次爬取都直接查 DB，不快取，確保新發表的文章/短文立刻出現在 sitemap 上。
export const dynamic = 'force-dynamic'

const SITE_URL = SITE_CONFIG.url

type ChangeFreq =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never'

/**
 * 分頁抓完所有已發布資料，避免預設分頁大小（如 20 篇）漏掉較舊的文章/短文。
 */
async function fetchAll<T>(
  fetchPage: (page: number) => Promise<{ data: T[]; hasMore: boolean }>
): Promise<T[]> {
  const all: T[] = []
  let page = 1
  while (true) {
    const { data, hasMore } = await fetchPage(page)
    all.push(...data)
    if (!hasMore) break
    page += 1
  }
  return all
}

/**
 * 一個頁面產生 zh-tw / en 兩筆 entry，並用 alternates.languages 互相標註，
 * 對齊 app/lib/metadata.ts 既有的 canonical／hreflang 策略。
 */
function localizedEntry(
  path: string,
  lastModified: Date,
  changeFrequency: ChangeFreq,
  priority: number
): MetadataRoute.Sitemap {
  const zhUrl = `${SITE_URL}${path}`
  // 首頁的 path 是 '/'，直接串會得到 /en/ —— 那個網址會 308 到 /en，
  // 跟頁面自己的 canonical 對不上。
  const enUrl = `${SITE_URL}/en${path === '/' ? '' : path}`
  const alternates = { languages: { 'zh-TW': zhUrl, en: enUrl } }

  return [
    { url: zhUrl, lastModified, changeFrequency, priority, alternates },
    { url: enUrl, lastModified, changeFrequency, priority, alternates },
  ]
}

// ponytail: 攝影單張頁暫時不進 sitemap。原檔目前是公開的全解析度檔案、
// EXIF 含精確 GPS，在收掉之前不主動請搜尋引擎來索引 98 張照片。
// 恢復條件：非 HDR 不再送 urlOriginal、原檔剝掉 GPS、寫入 Copyright 之後，
// 把 photoEntries 加回來（連同 localizedEntry 的 images 參數，指向最大衍生階
// 而非原檔，選法同 PhotoJsonLd）。

// /lab 底下是設計系統與漸層曲線這類自用工具，頁面照樣公開可連，
// 但不進 sitemap、metadata 也標 noIndex，不佔搜尋結果版面。
const STATIC_PAGES: Array<{
  path: string
  changeFrequency: ChangeFreq
  priority: number
}> = [
  { path: '/about', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/photography', changeFrequency: 'weekly', priority: 0.6 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createPublicClient()

  const [posts, notes] = await Promise.all([
    fetchAll((page) => getPublishedPosts(supabase, { page, pageSize: 100 })),
    fetchAll((page) => getPublishedNotes(supabase, { page, pageSize: 100 })),
  ])

  const now = new Date()
  const latestPostDate = posts[0]?.publishedAt
    ? new Date(posts[0].publishedAt)
    : now
  const latestNoteDate = notes[0]?.publishedAt
    ? new Date(notes[0].publishedAt)
    : now

  const homeEntry = localizedEntry('/', latestPostDate, 'daily', 1)
  const blogListEntry = localizedEntry('/blog', latestPostDate, 'daily', 0.8)
  const notesListEntry = localizedEntry('/notes', latestNoteDate, 'daily', 0.6)

  const staticEntries = STATIC_PAGES.flatMap(
    ({ path, changeFrequency, priority }) =>
      localizedEntry(path, now, changeFrequency, priority)
  )

  const postEntries = posts.flatMap((post) =>
    localizedEntry(
      `/blog/${post.slug}`,
      new Date(post.updatedAt || post.publishedAt || post.createdAt),
      'weekly',
      0.7
    )
  )

  const noteEntries = notes.flatMap((note) =>
    localizedEntry(
      `/notes/${note.id}`,
      new Date(note.publishedAt || note.createdAt),
      'monthly',
      0.5
    )
  )

  return [
    ...homeEntry,
    ...blogListEntry,
    ...notesListEntry,
    ...staticEntries,
    ...postEntries,
    ...noteEntries,
  ]
}
