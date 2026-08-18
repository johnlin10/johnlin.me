import type { SupabaseClient } from '@supabase/supabase-js'
import type { PhotoExif, PhotoLocales } from '@/app/types/photo'
import { getPostsForAdmin } from './posts'
import { getNotesForAdmin } from './notes'

/** 熱門排行與趨勢的回看天數。 */
const TREND_DAYS = 30
const RECENT_DAYS = 7
const TOP_POSTS = 5
const ACTIVITY_LIMIT = 12

export interface DashboardTotals {
  published: number
  postChars: number
  noteChars: number
  photos: number
  photoYearSpan: number
  views: number
  viewsRecent: number
}

export interface TopPost {
  id: string
  slug: string
  title: string
  views: number
  viewsRecent: number
}

export interface Bucket {
  label: string
  count: number
}

export type ActivityKind = 'post' | 'note' | 'photo'

export interface ActivityItem {
  kind: ActivityKind
  /** ISO 字串，已排序 */
  at: string
  title: string
  /** 同一天的照片上傳併成一筆時的張數，其餘為 undefined */
  groupCount?: number
  href: string
}

export interface ContentGaps {
  missingEnglish: number
  staleDrafts: number
  photosWithoutCaption: number
  photosWithoutLocation: number
}

export interface DashboardData {
  totals: DashboardTotals
  topPosts: TopPost[]
  cameras: Bucket[]
  focalLengths: Bucket[]
  photoYears: Bucket[]
  activity: ActivityItem[]
  gaps: ContentGaps
  /** post_view_daily 的最早一天，用來說明「趨勢從哪天開始有資料」 */
  trendSince: string | null
}

/** 只取統計要用的欄位。全欄含 derivatives 與 blur dataURL，是這裡的 9 倍大。 */
const PHOTO_STAT_SELECT =
  'slug,status,taken_at,taken_at_local,exif,locales,location,created_at'

type PhotoStatRow = {
  slug: string
  status: string
  taken_at: string
  taken_at_local: string
  exif: PhotoExif | null
  locales: PhotoLocales | null
  location: unknown | null
  created_at: string
}

type ViewDailyRow = { post_id: string; day: string; views: number }

/** TipTap 的 HTML 去標籤後才是字數；空白也不算。 */
function textLength(html: string): number {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, '')
    .length
}

/**
 * 同一台機器在 EXIF 裡可能有多種寫法（實例：`iPhone SE 2nd Gen` 與
 * `iPhone SE (2nd generation)`）。正規化只用來歸併計數，顯示時取最短的
 * 那個原字串——短的通常就是廠商的正式簡寫。
 */
function cameraKey(model: string): string {
  return model
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/\bgeneration\b/g, 'gen')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 攝影界慣用的等效焦段分段，不是等距切——等距切會讓望遠端全部擠在一格。 */
const FOCAL_BANDS: { max: number; label: string }[] = [
  { max: 24, label: '≤24' },
  { max: 35, label: '25–35' },
  { max: 50, label: '36–50' },
  { max: 85, label: '51–85' },
  { max: 135, label: '86–135' },
  { max: Infinity, label: '>135' },
]

function focalBand(mm: number): string {
  return FOCAL_BANDS.find((b) => mm <= b.max)!.label
}

function countBy<T>(items: T[], key: (item: T) => string | null): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of items) {
    const k = key(item)
    if (k === null) continue
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return counts
}

function daysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/**
 * 後台總覽的全部數據。四個查詢併發，統計在 client 端算完。
 *
 * ponytail: 聚合在 JS 裡做，內容量到數千筆才需要改成 Postgres 端的
 * materialized view 或 RPC。屆時換的是這個函式的內部，回傳型別不動。
 */
export async function getDashboardData(
  supabase: SupabaseClient
): Promise<DashboardData> {
  const [posts, notes, photoRes, viewRes] = await Promise.all([
    getPostsForAdmin(supabase, {}),
    getNotesForAdmin(supabase),
    supabase.from('photos').select(PHOTO_STAT_SELECT),
    supabase
      .from('post_view_daily')
      .select('post_id,day,views')
      .gte('day', daysAgo(TREND_DAYS)),
  ])
  if (photoRes.error) throw photoRes.error
  if (viewRes.error) throw viewRes.error

  const photos = (photoRes.data ?? []) as PhotoStatRow[]
  const viewRows = (viewRes.data ?? []) as ViewDailyRow[]

  const publishedPosts = posts.filter((p) => p.status === 'published')
  const publishedNotes = notes.filter((n) => n.status === 'published')
  const publishedPhotos = photos.filter((p) => p.status === 'published')

  //* ---------- 近期瀏覽（每篇） ----------
  const recentCutoff = daysAgo(RECENT_DAYS)
  const recentViews = new Map<string, number>()
  for (const row of viewRows) {
    if (row.day < recentCutoff) continue
    recentViews.set(row.post_id, (recentViews.get(row.post_id) ?? 0) + row.views)
  }

  //* ---------- 累積成果 ----------
  const shotYears = publishedPhotos.map((p) => Number(p.taken_at_local.slice(0, 4)))
  const totals: DashboardTotals = {
    published: publishedPosts.length + publishedNotes.length + publishedPhotos.length,
    postChars: publishedPosts.reduce(
      (sum, p) => sum + textLength(p.locales['zh-tw']?.content ?? ''),
      0
    ),
    noteChars: publishedNotes.reduce((sum, n) => sum + textLength(n.content), 0),
    photos: publishedPhotos.length,
    photoYearSpan: shotYears.length ? Math.max(...shotYears) - Math.min(...shotYears) + 1 : 0,
    views: posts.reduce((sum, p) => sum + (p.viewCount ?? 0), 0),
    viewsRecent: [...recentViews.values()].reduce((sum, v) => sum + v, 0),
  }

  //* ---------- 熱門文章 ----------
  const topPosts: TopPost[] = publishedPosts
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.locales['zh-tw']?.title || p.locales.en?.title || p.slug,
      views: p.viewCount ?? 0,
      viewsRecent: recentViews.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, TOP_POSTS)

  //* ---------- 攝影檔案 ----------
  const withExif = publishedPhotos.filter((p) => p.exif)

  const cameraLabels = new Map<string, string>()
  for (const p of withExif) {
    const model = p.exif?.model
    if (!model) continue
    const key = cameraKey(model)
    const existing = cameraLabels.get(key)
    if (!existing || model.length < existing.length) cameraLabels.set(key, model)
  }
  const cameras: Bucket[] = [...countBy(withExif, (p) =>
    p.exif?.model ? cameraKey(p.exif.model) : null
  )]
    .map(([key, count]) => ({ label: cameraLabels.get(key) ?? key, count }))
    .sort((a, b) => b.count - a.count)

  // 等效焦距優先；沒有 0xA405 的機身退回實體焦距，總比整張漏掉好。
  const focalCounts = countBy(withExif, (p) => {
    const mm = p.exif?.focalLength35 ?? p.exif?.focalLength
    return typeof mm === 'number' && mm > 0 ? focalBand(mm) : null
  })
  const focalLengths: Bucket[] = FOCAL_BANDS.map(({ label }) => ({
    label,
    count: focalCounts.get(label) ?? 0,
  }))

  const yearCounts = countBy(publishedPhotos, (p) => p.taken_at_local.slice(0, 4))
  const years = [...yearCounts.keys()].map(Number)
  const photoYears: Bucket[] = years.length
    ? Array.from(
        { length: Math.max(...years) - Math.min(...years) + 1 },
        (_, i) => String(Math.min(...years) + i)
      ).map((year) => ({ label: year, count: yearCounts.get(year) ?? 0 }))
    : []

  //* ---------- 最近動態 ----------
  const activity: ActivityItem[] = [
    ...posts.map((p) => ({
      kind: 'post' as const,
      at: p.publishedAt ?? p.createdAt,
      title: p.locales['zh-tw']?.title || p.slug,
      href: `/admin/posts/${p.id}`,
    })),
    ...notes.map((n) => ({
      kind: 'note' as const,
      at: n.publishedAt ?? n.createdAt,
      title: n.content.slice(0, 40),
      href: '/admin/notes',
    })),
    // 照片一次上傳幾十張，逐張列會把其他兩種內容整個沖掉，按日併成一筆。
    ...[...countBy(photos, (p) => p.created_at.slice(0, 10))].map(([day, count]) => ({
      kind: 'photo' as const,
      at: `${day}T00:00:00.000Z`,
      title: day,
      groupCount: count,
      href: '/admin/photos',
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, ACTIVITY_LIMIT)

  //* ---------- 缺口 ----------
  const staleCutoff = new Date()
  staleCutoff.setUTCDate(staleCutoff.getUTCDate() - RECENT_DAYS)
  const gaps: ContentGaps = {
    missingEnglish: publishedPosts.filter(
      (p) => textLength(p.locales.en?.content ?? '') === 0
    ).length,
    staleDrafts: posts.filter(
      (p) => p.status === 'draft' && new Date(p.updatedAt) < staleCutoff
    ).length,
    photosWithoutCaption: publishedPhotos.filter(
      (p) => !p.locales?.['zh-tw']?.caption
    ).length,
    photosWithoutLocation: publishedPhotos.filter((p) => !p.location).length,
  }

  const days = viewRows.map((r) => r.day).sort()

  return {
    totals,
    topPosts,
    cameras,
    focalLengths,
    photoYears,
    activity,
    gaps,
    trendSince: days[0] ?? null,
  }
}
