import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 上傳單張圖片，回傳公開 URL。
 * @param folder bucket 內的資料夾（可空字串），如 'covers'、'images/<postId>'
 * @param bucket 目標 bucket，預設 'blog'（短文用 'notes'）
 */
export async function uploadImage(
  supabase: SupabaseClient,
  file: File,
  folder: string,
  bucket: string = 'blog'
): Promise<string> {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'png'
  const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  const path = folder ? `${folder}/${name}` : name

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type || undefined, upsert: false })
  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

/**
 * 從 HTML 擷取所有 <img src>。
 */
export function extractImageUrlsFromHtml(html: string): string[] {
  const imgRegex = /<img[^>]+src="([^">]+)"/g
  const urls: string[] = []
  let match
  while ((match = imgRegex.exec(html)) !== null) urls.push(match[1])
  return urls
}

/**
 * 將 HTML 內嵌的 base64 圖片上傳成 Storage URL 並替換。
 */
export async function uploadAndReplaceImagesInHtml(
  supabase: SupabaseClient,
  html: string,
  folder: string
): Promise<string> {
  let updated = html
  const base64Regex = /<img[^>]+src="(data:image\/[^;]+;base64,[^"]+)"/g
  const matches = [...html.matchAll(base64Regex)]

  for (const match of matches) {
    const base64Data = match[1]
    const file = await base64ToFile(base64Data)
    const url = await uploadImage(supabase, file, folder)
    updated = updated.replace(base64Data, url)
  }
  return updated
}

async function base64ToFile(base64: string): Promise<File> {
  const response = await fetch(base64)
  const blob = await response.blob()
  return new File([blob], `image_${Date.now()}.png`, { type: blob.type })
}

/**
 * 從 Storage 公開 URL 反推 bucket 與物件路徑。
 * 非本站 Storage 網址（例如手動貼上的外部圖片）回傳 null，呼叫端應略過不刪。
 */
export function parseStoragePath(
  publicUrl: string
): { bucket: string; path: string } | null {
  try {
    const { pathname } = new URL(publicUrl)
    const marker = '/storage/v1/object/public/'
    const markerIndex = pathname.indexOf(marker)
    if (markerIndex === -1) return null

    const rest = pathname.slice(markerIndex + marker.length) // "notes/171..._ab.jpg"
    const slashIndex = rest.indexOf('/')
    if (slashIndex === -1) return null

    return {
      bucket: rest.slice(0, slashIndex),
      path: decodeURIComponent(rest.slice(slashIndex + 1)),
    }
  } catch {
    return null
  }
}

/**
 * 盡力刪除一批圖片檔案。失敗只記 log，不拋出——孤兒檔案不該擋住
 * 已經成功的資料庫寫入（例如筆記已更新/刪除，但其中一張圖清不掉）。
 */
export async function deleteImages(
  supabase: SupabaseClient,
  urls: string[]
): Promise<void> {
  const byBucket = new Map<string, string[]>()
  for (const url of urls) {
    const parsed = parseStoragePath(url)
    if (!parsed) continue
    const paths = byBucket.get(parsed.bucket) ?? []
    paths.push(parsed.path)
    byBucket.set(parsed.bucket, paths)
  }

  for (const [bucket, paths] of byBucket) {
    const { error } = await supabase.storage.from(bucket).remove(paths)
    if (error) console.warn('[deleteImages]', bucket, error.message)
  }
}
