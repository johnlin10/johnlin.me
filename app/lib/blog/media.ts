//* 後台文章圖片的上傳（瀏覽器端）。檔案在 R2，流程與短文共用 uploadMedia。
import { isSupportedPhotoMime } from '@/app/lib/photos/mime'
import { uploadMedia } from '@/app/lib/notes/media'
import type { PostImage } from '@/app/types/blog'

/** 內文圖片最寬就是正文欄 720px。 */
export const POST_CONTENT_IMAGE_SIZES = '(max-width: 720px) 100vw, 720px'

/**
 * 上傳一張文章圖片（封面或內文）。
 * @param file 要上傳的圖片
 * @returns 最大一級的網址與四級 srcset
 */
export function uploadPostImage(file: File): Promise<PostImage> {
  return uploadMedia<PostImage>(file, '/api/admin/posts/media')
}

export { postImageUrls } from './postImageUrls'

/**
 * 請伺服器清掉這些圖片裡已經沒有任何文章在用的，並順便掃一次放太久的孤兒，所以清單是空的也照樣送。
 * 盡力而為，失敗只記 log：孤兒檔案不該擋住已經成功的資料庫寫入。
 * @param urls 可能不要了的圖片網址
 */
export async function deletePostMedia(urls: string[]): Promise<void> {
  try {
    const res = await fetch('/api/admin/posts/media', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ urls }),
    })
    if (!res.ok) console.warn('[deletePostMedia]', res.status)
  } catch (error) {
    console.warn('[deletePostMedia]', error)
  }
}

/**
 * 把 HTML 裡內嵌的 base64 圖片（例如貼上 Notion/Word 的片段）上傳到 R2，換成網址與 srcset。
 * 白名單外的格式（GIF、SVG 等）留在原處，不擋住存檔。
 * @param html TipTap 輸出的 HTML
 * @returns 換好網址的 HTML
 */
export async function uploadBase64Images(html: string): Promise<string> {
  let updated = html
  for (const [, dataUrl, mime] of html.matchAll(/<img[^>]+src="(data:(image\/[^;]+);base64,[^"]+)"/g)) {
    if (!isSupportedPhotoMime(mime)) continue
    const blob = await (await fetch(dataUrl)).blob()
    const img = await uploadPostImage(new File([blob], 'pasted', { type: blob.type }))
    updated = updated.replace(
      `src="${dataUrl}"`,
      `src="${img.url}" srcset="${img.srcset}" sizes="${POST_CONTENT_IMAGE_SIZES}"`
    )
  }
  return updated
}
