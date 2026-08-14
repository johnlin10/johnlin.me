import slugify from 'slugify'

/**
 * `/gallery/[slug]` 這條路由同時要給照片和未來的攝影理念頁用，
 * 所以照片 slug 必須避開理念頁會佔掉的字。
 * 之後決定理念頁網址時把實際字串加進來即可 —— 加了之後既有照片不受影響，
 * 只有新上傳的會避開。
 */
export const RESERVED_SLUGS = new Set([
  'about',
  'feed',
  'index',
  'manifesto',
  'new',
  'philosophy',
  'rss',
  'why',
])

/** DB 的 photos_slug_format_check 就是這條，前端先擋一次避免無謂的來回。 */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function isValidPhotoSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.has(slug)
}

/**
 * 從拍攝日期（`taken_at_local` 的前 10 碼）產生 slug 基底。
 *
 * hint 給的是英文說明或地名；slugify 對純中文只會回傳空字串，
 * 這種情況就退回純日期加隨機碼。日期放前面是刻意的 ——
 * 分享出去的網址本身就帶著「這是哪一天的瞬間」。
 */
export function makePhotoSlugBase(takenAtLocal: string, hint?: string): string {
  const date = takenAtLocal.slice(0, 10)
  const named = hint
    ? slugify(hint, { lower: true, strict: true, trim: true }).slice(0, 40)
    : ''
  if (named) return `${date}-${named}`
  return `${date}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * 讓 slug 在 `taken` 這組已用字之外唯一。
 * 真正的唯一性由 DB 的 UNIQUE constraint 保證，這裡只是讓批次上傳
 * 不必為了撞號來回打資料庫；呼叫端仍要處理 23505（見 posts.ts 的 isUniqueViolation）。
 *
 * 會就地把回傳值加進 taken，所以同一批次連續呼叫不會自己撞自己。
 */
export function ensureUniquePhotoSlug(
  base: string,
  taken: Set<string>
): string {
  let candidate = base
  let n = 2
  while (taken.has(candidate) || RESERVED_SLUGS.has(candidate)) {
    candidate = `${base}-${n}`
    n += 1
  }
  taken.add(candidate)
  return candidate
}
