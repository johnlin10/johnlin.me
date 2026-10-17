import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/app/lib/supabase/requireAdmin'
import { createClient } from '@/app/lib/supabase/server'
import { postImageIdFromUrl, postImagePrefix } from '@/app/lib/r2/keys'
import { deletePrefix } from '@/app/lib/r2/objects'

const requestBody = z.object({ urls: z.array(z.string()).max(200) })

/**
 * 清掉沒有人在用的文章圖片（整個資料夾，原檔與各級一起）。
 * 呼叫端只給「可能不要了」的網址，要不要刪由這裡重讀資料庫決定：
 * 還被任何一篇文章或系列封面引用的就留著，所以未儲存的離開、跨文章複製的圖片都不會誤刪。
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

  const ids = new Set(parsed.data.urls.flatMap((url) => postImageIdFromUrl(url) ?? []))
  if (ids.size === 0) return NextResponse.json({ result: { removed: 0, kept: 0 } })

  try {
    const supabase = await createClient()
    const [posts, series] = await Promise.all([
      supabase.from('posts').select('cover_image, locales'),
      supabase.from('series').select('cover_image'),
    ])
    // 讀不到就整批不刪：寧可留孤兒，也不能把還在用的圖刪掉
    if (posts.error) throw posts.error
    if (series.error) throw series.error
    if (posts.data.length === 0) throw new Error('讀到 0 篇文章，可能是權限問題，這次不刪')
    const inUse = JSON.stringify([posts.data, series.data])

    let removed = 0
    let kept = 0
    for (const id of ids) {
      if (inUse.includes(id)) kept++
      else removed += await deletePrefix(postImagePrefix(id))
    }
    return NextResponse.json({ result: { removed, kept } })
  } catch (error) {
    console.error('[api/admin/posts/media]', error)
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 })
  }
}
