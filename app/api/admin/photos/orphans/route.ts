import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/app/lib/supabase/requireAdmin'
import { createClient } from '@/app/lib/supabase/server'
import { getPhotosForAdmin } from '@/app/lib/supabase/photos'
import { assetIdFromKey, photoPrefix, photosRootPrefix } from '@/app/lib/r2/keys'
import { deletePrefix, listKeys } from '@/app/lib/r2/objects'

/** 一張照片正常會有 8 階衍生檔 + OG + 原檔，物件數遠低於分頁上限。 */
async function scan() {
  const supabase = await createClient()
  const [keys, photos] = await Promise.all([
    listKeys(photosRootPrefix()),
    getPhotosForAdmin(supabase),
  ])

  const objectCounts = new Map<string, number>()
  for (const key of keys) {
    const assetId = assetIdFromKey(key)
    if (!assetId) continue
    objectCounts.set(assetId, (objectCounts.get(assetId) ?? 0) + 1)
  }

  const rowIds = new Set(photos.map((p) => p.id))

  // R2 有檔案但資料庫沒有列：上傳到一半放棄、或 ingest 失敗後沒有重試。
  const orphaned = [...objectCounts.entries()]
    .filter(([assetId]) => !rowIds.has(assetId))
    .map(([assetId, objectCount]) => ({ assetId, objectCount }))

  // 資料庫有列但 R2 沒檔案：這個方向反而更嚴重 —— 前台會是破圖。
  // 只回報，不自動處理：要刪的是一筆有 slug、有說明的資料，該由人決定。
  const missing = photos
    .filter((p) => !objectCounts.has(p.id))
    .map((p) => ({ id: p.id, slug: p.slug }))

  return { orphaned, missing }
}

/** 盤點。純讀取，不動任何東西。 */
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? '請先登入' : '沒有權限' },
      { status: auth.status }
    )
  }

  try {
    return NextResponse.json({ result: await scan() })
  } catch (error) {
    console.error('[api/admin/photos/orphans] GET', error)
    return NextResponse.json({ error: '盤點失敗' }, { status: 500 })
  }
}

const cleanupBody = z.object({
  assetIds: z.array(z.uuid()).min(1),
})

/**
 * 清掉指定的孤兒前綴。
 *
 * 送進來的 id 一律重新盤點一次再刪 —— 不是不信任前端，而是盤點結果與按下
 * 清理之間可能隔了很久，這中間如果有新的上傳剛好用了同一個 assetId
 * （或使用者在另一個分頁重試成功了），照清下去就會把一張活著的照片的檔案
 * 刪掉。伺服器端這一關是唯一能保證「刪的當下它確實還是孤兒」的地方。
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? '請先登入' : '沒有權限' },
      { status: auth.status }
    )
  }

  const parsed = cleanupBody.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '請求格式錯誤' }, { status: 400 })
  }

  try {
    const { orphaned } = await scan()
    const stillOrphaned = new Set(orphaned.map((o) => o.assetId))
    const targets = parsed.data.assetIds.filter((id) => stillOrphaned.has(id))

    let removedObjects = 0
    for (const assetId of targets) {
      removedObjects += await deletePrefix(photoPrefix(assetId))
    }

    return NextResponse.json({
      result: {
        removedObjects,
        removedAssets: targets.length,
        skipped: parsed.data.assetIds.length - targets.length,
      },
    })
  } catch (error) {
    console.error('[api/admin/photos/orphans] POST', error)
    return NextResponse.json({ error: '清理失敗' }, { status: 500 })
  }
}
