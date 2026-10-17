import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/app/lib/supabase/requireAdmin'
import { PHOTO_MIME_TYPES, extForPhotoMime } from '@/app/lib/photos/mime'
import { postOriginalKey } from '@/app/lib/r2/keys'
import { presignPut } from '@/app/lib/r2/presign'

/** 與攝影原檔同一個上限；presign 不簽 ContentLength，只能在發 URL 前擋。 */
const MAX_ORIGINAL_BYTES = 80 * 1024 * 1024

const requestBody = z.object({
  id: z.uuid(),
  contentType: z.enum(PHOTO_MIME_TYPES),
  contentLength: z.number().int().positive().max(MAX_ORIGINAL_BYTES),
})

/** 文章圖片原檔直傳 R2 的 presigned PUT。 */
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
    return NextResponse.json({ error: '格式不支援或檔案過大' }, { status: 400 })
  }
  const { id, contentType } = parsed.data

  try {
    const key = postOriginalKey(id, extForPhotoMime(contentType)!)
    return NextResponse.json({ result: await presignPut(key, contentType) })
  } catch (error) {
    console.error('[api/admin/posts/media/upload-url]', error)
    return NextResponse.json({ error: '無法建立上傳連結' }, { status: 500 })
  }
}
