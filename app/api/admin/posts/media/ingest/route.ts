import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/app/lib/supabase/requireAdmin'
import { extForPhotoMime } from '@/app/lib/photos/mime'
import { derivePostImage } from '@/app/lib/images/postDerivatives'
import { postOriginalKey, postStepKey } from '@/app/lib/r2/keys'
import { getObjectBuffer, headObject, putObjects } from '@/app/lib/r2/objects'
import type { PostImage } from '@/app/types/blog'

export const maxDuration = 60

const MAX_ORIGINAL_BYTES = 80 * 1024 * 1024

const requestBody = z.object({ id: z.uuid(), key: z.string().min(1) })

/**
 * 原檔已經直傳到 R2 之後，產生四級 webp，回傳一筆 PostImage。
 * 不寫 DB：封面或內文存檔時才會記錄這張圖。
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? '請先登入' : '沒有權限' },
      { status: auth.status }
    )
  }

  const parsed = requestBody.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '請求格式錯誤' }, { status: 400 })
  }
  const { id, key } = parsed.data

  // presign 沒簽 Content-Type，實際型別以 R2 上的物件為準，key 也要自己重新推導比對
  const head = await headObject(key)
  if (!head) return NextResponse.json({ error: '原檔尚未上傳完成' }, { status: 409 })
  const ext = extForPhotoMime(head.contentType)
  if (!ext || postOriginalKey(id, ext) !== key) {
    return NextResponse.json({ error: '格式不支援' }, { status: 422 })
  }

  try {
    const original = await getObjectBuffer(key, MAX_ORIGINAL_BYTES)
    const steps = await derivePostImage(original)
    const urls = await putObjects(
      steps.map((s) => ({ key: postStepKey(id, s.w), body: s.body, contentType: 'image/webp' }))
    )
    const result: PostImage = {
      url: urls[urls.length - 1],
      srcset: steps.map((s, i) => `${urls[i]} ${s.w}w`).join(', '),
    }
    return NextResponse.json({ result })
  } catch (error) {
    console.error('[api/admin/posts/media/ingest]', error)
    return NextResponse.json({ error: '處理圖片時失敗' }, { status: 500 })
  }
}
