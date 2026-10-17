import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/app/lib/supabase/requireAdmin'
import { createClient } from '@/app/lib/supabase/server'
import { pickPostImagesToDelete } from '@/app/lib/blog/orphanImages'
import {
  postImageIdFromKey,
  postImageIdFromUrl,
  postImagePrefix,
  postImagesRootPrefix,
} from '@/app/lib/r2/keys'
import { deletePrefix, listObjects } from '@/app/lib/r2/objects'

const requestBody = z.object({ urls: z.array(z.string()).max(200) })

/**
 * 清掉沒有人在用的文章圖片（整個資料夾，原檔與各級一起）。
 * 呼叫端點名「可能不要了」的網址，要不要刪由這裡重讀資料庫決定：
 * 還被任何一篇文章或系列封面引用的就留著，所以未儲存的離開、跨文章複製的圖片都不會誤刪。
 * 每次也順便掃整個 posts/images/：關分頁、用側邊欄離開這類沒走到清理的孤兒，放超過寬限期就一起刪。
 */
export async function DELETE(request: NextRequest) {
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
  const requested = parsed.data.urls.flatMap((url) => postImageIdFromUrl(url) ?? [])

  try {
    const supabase = await createClient()
    const [posts, series, objects] = await Promise.all([
      supabase.from('posts').select('cover_image, locales'),
      supabase.from('series').select('cover_image'),
      listObjects(postImagesRootPrefix()),
    ])
    // 讀不到就整批不刪：寧可留孤兒，也不能把還在用的圖刪掉
    if (posts.error) throw posts.error
    if (series.error) throw series.error
    if (posts.data.length === 0) throw new Error('讀到 0 篇文章，可能是權限問題，這次不刪')
    const inUse = JSON.stringify([posts.data, series.data])

    // 資料夾的時間取裡面最新的物件，保守一點
    const folders = new Map<string, number>()
    for (const { key, lastModified } of objects) {
      const id = postImageIdFromKey(key)
      if (id) folders.set(id, Math.max(folders.get(id) ?? 0, lastModified))
    }

    let removed = 0
    const ids = pickPostImagesToDelete(requested, folders, inUse, Date.now())
    for (const id of ids) removed += await deletePrefix(postImagePrefix(id))
    return NextResponse.json({ result: { folders: ids.length, removed } })
  } catch (error) {
    console.error('[api/admin/posts/media]', error)
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 })
  }
}
