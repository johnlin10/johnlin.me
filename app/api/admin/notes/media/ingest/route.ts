import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/app/lib/supabase/requireAdmin'
import { extForPhotoMime } from '@/app/lib/photos/mime'
import { NOTE_DISPLAY_EDGE, toWebp } from '@/app/lib/images/noteDerivatives'
import { noteDisplayKey, noteOriginalKey, publicUrl } from '@/app/lib/r2/keys'
import { getObjectBuffer, headObject, putObject } from '@/app/lib/r2/objects'
import type { NoteImage } from '@/app/types/note'

export const maxDuration = 60

const MAX_ORIGINAL_BYTES = 80 * 1024 * 1024

const requestBody = z.object({ id: z.uuid(), key: z.string().min(1) })

/**
 * 原檔已經直傳到 R2 之後，產生短文裡顯示用的小圖，回傳一筆 NoteImage。
 * 不寫 DB：短文按下發布／儲存時才會記錄這張圖。
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
  if (!ext || noteOriginalKey(id, ext) !== key) {
    return NextResponse.json({ error: '格式不支援' }, { status: 422 })
  }

  try {
    const original = await getObjectBuffer(key, MAX_ORIGINAL_BYTES)
    const display = await toWebp(original, NOTE_DISPLAY_EDGE)
    const url = await putObject(noteDisplayKey(id), display.body, 'image/webp')
    const result: NoteImage = { url, original: publicUrl(key), w: display.w, h: display.h }
    return NextResponse.json({ result })
  } catch (error) {
    console.error('[api/admin/notes/media/ingest]', error)
    return NextResponse.json({ error: '處理圖片時失敗' }, { status: 500 })
  }
}
