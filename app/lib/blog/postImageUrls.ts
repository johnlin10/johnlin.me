import type { CoverImage } from '@/app/types/blog'

/**
 * 一篇文章用到的所有圖片網址（封面加各語言內文的 img）。不分是不是 R2，交給伺服器過濾。
 * @param post 文章或編輯中的草稿
 * @returns 圖片網址
 */
export function postImageUrls(post: {
  coverImage?: CoverImage | null
  locales?: Partial<Record<string, { content?: string }>>
}): string[] {
  const urls = post.coverImage?.url ? [post.coverImage.url] : []
  for (const locale of Object.values(post.locales ?? {})) {
    for (const [, src] of (locale?.content ?? '').matchAll(/<img[^>]+src="([^"]+)"/g)) urls.push(src)
  }
  return urls
}
