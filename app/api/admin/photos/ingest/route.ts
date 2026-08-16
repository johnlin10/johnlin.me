import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/app/lib/supabase/requireAdmin'
import { createClient } from '@/app/lib/supabase/server'
import { createPhoto, getPhotoById } from '@/app/lib/supabase/photos'
import { isUniqueViolation } from '@/app/lib/supabase/errors'
import { extForPhotoMime } from '@/app/lib/photos/mime'
import { derivePhoto } from '@/app/lib/images/photoDerivatives'
import {
  derivativeKey,
  ogKey,
  originalKey,
  publicUrl,
} from '@/app/lib/r2/keys'
import { getObjectBuffer, headObject, putObjects } from '@/app/lib/r2/objects'
import type { CreatePhotoInput } from '@/app/types/photo'

/**
 * 一張 42 MB 的原檔在本機是 1.7 秒、318 MB RSS；Vercel 上抓 3–5 倍約 5–8 秒。
 * 300 秒是留給冷啟動加上偶爾特別大的檔案，不是預期值。
 *
 * 這個 export 與 repo「不寫 runtime」的慣例無關，是不同的東西。
 */
export const maxDuration = 300

/** 與 upload-url 同一個上限，getObjectBuffer 會據此擋下過大的物件。 */
const MAX_ORIGINAL_BYTES = 80 * 1024 * 1024

const localeFields = z.object({
  caption: z.string().optional(),
  locationName: z.string().optional(),
})

const requestBody = z.object({
  assetId: z.uuid(),
  /** 由 upload-url 發出的 key。伺服器會自己重新推導再比對，這裡只是方便除錯。 */
  key: z.string().min(1),
  // 與 DB 的 photos_slug_format_check 同一條
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  takenAt: z.iso.datetime({ offset: true }),
  // 與 DB 的 photos_taken_at_local_format_check 同一條
  takenAtLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/),
  takenAtPrecision: z.enum(['day', 'month', 'year']).default('day'),
  isHdr: z.boolean().default(false),
  exif: z
    .object({
      make: z.string(),
      model: z.string(),
      lens: z.string(),
      fNumber: z.number().positive(),
      exposureTime: z.number().positive(),
      iso: z.number().positive(),
      focalLength: z.number().positive(),
    })
    .partial()
    .nullable()
    .default(null),
  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .nullable()
    .default(null),
  locales: z.record(z.string(), localeFields).default({}),
})

/** 座標一律四捨五入到小數 3 位（約 110 公尺）。 */
function roundCoord(value: number): number {
  return Math.round(value * 1000) / 1000
}

/**
 * 把已經直傳到 R2 的原檔轉成一筆照片：產 SDR 階梯、OG 圖與模糊佔位，
 * 寫回 R2，最後建立資料列。
 *
 * 一次只處理一張。批次塞進同一個請求的話，第 29 張失敗會讓前面 28 張的
 * 工白做，而且沒有逐張的進度與重試。
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
  const body = parsed.data
  const supabase = await createClient()

  // 冪等：已經建好就直接回傳。重試與連點兩次「確認上傳」都不會重跑一次。
  const existing = await getPhotoById(supabase, body.assetId)
  if (existing) return NextResponse.json({ result: existing })

  // 原檔的實際型別以 R2 上的物件為準：presign 沒有把 Content-Type 簽進
  // SignedHeaders，上傳端可以送別的型別，所以宣告過的值不能信。
  const head = await headObject(body.key)
  if (!head) {
    return NextResponse.json({ error: '原檔尚未上傳完成' }, { status: 409 })
  }

  const ext = extForPhotoMime(head.contentType)
  if (!ext) {
    return NextResponse.json({ error: '無法讀取這個影像格式' }, { status: 422 })
  }

  // key 必須是我們自己推導得出來的那一個。放行任意 key 等於讓呼叫端指定
  // 一個之後會被 delete-by-prefix 掃到的位置。
  const expectedKey = originalKey(body.assetId, ext)
  if (expectedKey !== body.key) {
    return NextResponse.json({ error: '物件位置不符' }, { status: 400 })
  }

  try {
    const original = await getObjectBuffer(body.key, MAX_ORIGINAL_BYTES)
    const derived = await derivePhoto(original)

    const items = [
      ...derived.derivatives.map((d) => ({
        key: derivativeKey(body.assetId, d.width),
        body: d.body,
        contentType: 'image/webp',
      })),
      {
        key: ogKey(body.assetId),
        body: derived.og,
        contentType: 'image/jpeg',
      },
    ]
    const urls = await putObjects(items)
    const ogUrl = urls[derived.derivatives.length]

    const input: CreatePhotoInput = {
      id: body.assetId,
      slug: body.slug,
      derivatives: derived.derivatives.map((d, i) => ({
        w: d.width,
        url: urls[i],
      })),
      urlOriginal: publicUrl(body.key),
      urlOg: ogUrl,
      blurDataUrl: derived.blurDataUrl,
      originalMime: head.contentType,
      originalBytes: head.contentLength,
      width: derived.width,
      height: derived.height,
      isHdr: body.isHdr,
      takenAt: body.takenAt,
      takenAtLocal: body.takenAtLocal,
      takenAtPrecision: body.takenAtPrecision,
      location: body.location
        ? { lat: roundCoord(body.location.lat), lng: roundCoord(body.location.lng) }
        : undefined,
      exif: body.exif ?? undefined,
      locales: body.locales,
      // 一律先進草稿。開發時寫進正式資料表的列也因此不會出現在前台。
      status: 'draft',
    }

    await createPhoto(supabase, input)
    const photo = await getPhotoById(supabase, body.assetId)
    return NextResponse.json({ result: photo })
  } catch (error) {
    // 失敗時刻意不清 R2。
    //
    // 衍生檔的 key 完全由 assetId 與寬度決定，重試會原地覆蓋，所以殘留的
    // 半套衍生檔不會造成錯誤狀態；而資料列是在所有上傳都成功之後才建立的，
    // 不可能出現「row 指向不完整的階梯」。
    //
    // 反過來，清掉整個前綴會連原檔一起刪 —— 那代表一次 slug 撞號就要使用者
    // 重傳 42 MB。真正要處理的只有「使用者放棄重試」留下的孤兒，那是 R2 上
    // 有物件但資料庫沒有列，靠孤兒盤點掃出來，不該由這條路徑猜。
    console.error('[api/admin/photos/ingest]', error)

    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: 'slug 已被使用' }, { status: 409 })
    }
    if (error instanceof Error && error.message.startsWith('物件過大')) {
      return NextResponse.json({ error: '原始檔案過大' }, { status: 413 })
    }
    return NextResponse.json({ error: '處理照片時失敗' }, { status: 500 })
  }
}
