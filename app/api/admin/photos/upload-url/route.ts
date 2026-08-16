import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/app/lib/supabase/requireAdmin'
import { PHOTO_MIME_TYPES } from '@/app/lib/photos/mime'
import { presignOriginalPut } from '@/app/lib/r2/presign'

/**
 * 原檔大小上限。實測最大的樣本（iPhone 的 HDR JPEG）是 42 MB，
 * 留兩倍空間。這個限制在這裡擋 —— presign 不簽 ContentLength，
 * 所以「先驗再決定要不要發 URL」是唯一擋得住的位置。
 */
const MAX_ORIGINAL_BYTES = 80 * 1024 * 1024

const requestBody = z.object({
  assetId: z.uuid(),
  contentType: z.enum(PHOTO_MIME_TYPES),
  contentLength: z.number().int().positive().max(MAX_ORIGINAL_BYTES),
})

/**
 * 發給瀏覽器直傳原檔用的 presigned PUT。
 *
 * 為什麼不讓檔案經過這支路由：Vercel 的 request body 上限是 4.5 MB，
 * 原檔進不來。ingest 那支改成從 R2 抓回去處理。
 *
 * proxy.ts 的 matcher 排除了 /api，權限檢查一律靠 requireAdmin()。
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

  try {
    const result = await presignOriginalPut(parsed.data)
    return NextResponse.json({ result })
  } catch (error) {
    console.error('[api/admin/photos/upload-url]', error)
    return NextResponse.json({ error: '無法建立上傳連結' }, { status: 500 })
  }
}
