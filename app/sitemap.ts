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
  const enUrl = `${SITE_URL}/en${path}`
  const alternates = { languages: { 'zh-TW': zhUrl, en: enUrl } }

  return [
    { url: zhUrl, lastModified, changeFrequency, priority, alternates },
    { url: enUrl, lastModified, changeFrequency, priority, alternates },
  ]
}

const STATIC_PAGES: Array<{
  path: string
  changeFrequency: ChangeFreq
  priority: number
}> = [
  { path: '/about', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/gallery', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/lab', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/lab/design', changeFrequency: 'monthly', priority: 0.3 },
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
