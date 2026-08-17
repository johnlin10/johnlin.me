import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/app/lib/supabase/requireAdmin'
import { createClient } from '@/app/lib/supabase/server'
import { deletePhoto } from '@/app/lib/supabase/photos'
import { photoPrefix } from '@/app/lib/r2/keys'
import { deletePrefix } from '@/app/lib/r2/objects'
import { revalidatePhotos } from '@/app/lib/photos/revalidatePhotos'

/**
 * 刪除一張照片：資料列與 R2 上的整組物件。
 *
 * 順序刻意是「先刪 row、再清 R2」，兩種失敗的後果不對等：
 * - 先清 R2 而 row 沒刪掉 → 前台留下一筆指向不存在檔案的照片，訪客看到破圖，
 *   而且沒有任何機制會自己發現。
 * - 先刪 row 而 R2 沒清掉 → 只是留下沒人引用的檔案，孤兒盤點掃得出來，
 *   訪客完全不受影響。
 * 所以 R2 那一步是 best-effort，清不掉也回成功，不把可回復的問題升級成
 * 不可回復的問題。
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? '請先登入' : '沒有權限' },
      { status: auth.status }
    )
  }

  const { id } = await params
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: '請求格式錯誤' }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    await deletePhoto(supabase, id)
    revalidatePhotos()

    let removedObjects = 0
    try {
      removedObjects = await deletePrefix(photoPrefix(id))
    } catch (cleanupError) {
      console.error('[api/admin/photos/[id]] R2 清理失敗', cleanupError)
    }

    return NextResponse.json({ result: { removedObjects } })
  } catch (error) {
    console.error('[api/admin/photos/[id]]', error)
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 })
  }
}
