import type { Photo } from '@/app/types/photo'
import { xhrPut } from './xhrPut'
import { toIngestPayload, type StagedPhoto } from './stagedPhoto'

interface UploadCallbacks {
  onProgress: (progress: number) => void
  onStatusChange: (status: 'uploading' | 'processing') => void
}

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
 * 單張照片的完整上傳流程：presign → 直傳 R2（有進度）→ ingest。
 * 三步驟依序執行，任一步失敗就整體失敗，呼叫端負責重試（同一個 assetId，
 * ingest 端已做冪等，presign 與 PUT 本身重跑也安全）。
 */
export async function uploadPhoto(
  photo: StagedPhoto,
  takenAtLocal: string,
  takenAt: string,
  callbacks: UploadCallbacks,
  signal?: AbortSignal
): Promise<Photo> {
  callbacks.onStatusChange('uploading')
  const presign = await postJson<{ key: string; uploadUrl: string }>(
    '/api/admin/photos/upload-url',
    {
      assetId: photo.assetId,
      contentType: photo.file.type,
      contentLength: photo.file.size,
    }
  )

  await xhrPut(
    presign.uploadUrl,
    photo.file,
    photo.file.type,
    (loaded, total) => callbacks.onProgress(total > 0 ? loaded / total : 0),
    signal
  )

  callbacks.onStatusChange('processing')
  const payload = { ...toIngestPayload(photo, takenAtLocal, takenAt), key: presign.key }
  return postJson<Photo>('/api/admin/photos/ingest', payload)
}
