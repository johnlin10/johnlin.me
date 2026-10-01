//* 後台短文媒體的上傳與刪除（瀏覽器端）。檔案在 R2，密鑰只在伺服器，所以都走 /api/admin/notes/media。
import { isSupportedPhotoMime } from '@/app/lib/photos/mime'
import type { NoteImage } from '@/app/types/note'

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? `請求失敗（${res.status}）`)
  return json.result as T
}

/**
 * 原檔直傳 R2 → 伺服器產生顯示用小圖 → 回傳 NoteImage（url 是小圖、original 是原檔）。
 * 格式不在白名單（HEIC、GIF 等）直接拒絕，不浪費一次上傳。
 */
export async function uploadNoteImage(file: File): Promise<NoteImage> {
  if (!isSupportedPhotoMime(file.type)) throw new Error(`不支援的格式：${file.type || file.name}`)
  const id = crypto.randomUUID()
  const presign = await postJson<{ key: string; uploadUrl: string }>(
    '/api/admin/notes/media/upload-url',
    { id, contentType: file.type, contentLength: file.size }
  )
  const put = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': file.type },
    body: file,
  })
  if (!put.ok) throw new Error(`上傳失敗（${put.status}）`)
  return postJson<NoteImage>('/api/admin/notes/media/ingest', { id, key: presign.key })
}

/** 盡力刪除，失敗只記 log：孤兒檔案不該擋住已經成功的資料庫寫入。 */
export async function deleteNoteMedia(urls: string[]): Promise<void> {
  if (urls.length === 0) return
  try {
    const res = await fetch('/api/admin/notes/media', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ urls }),
    })
    if (!res.ok) console.warn('[deleteNoteMedia]', res.status)
  } catch (error) {
    console.warn('[deleteNoteMedia]', error)
  }
}
