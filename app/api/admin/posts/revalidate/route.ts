import { NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { requireAdmin } from '@/app/lib/supabase/requireAdmin'

/**
 * 文章列表、文章頁、首頁都是 revalidate = 300，後台改動會出現在網站上的
 * 文章內容後打這支，才會立刻反映。首頁的最新文章另有一層 unstable_cache
 * （tag: 'posts'），只清路由的話頁面會重繪、文章還是舊的。
 */
export async function POST() {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? '請先登入' : '沒有權限' },
      { status: auth.status }
    )
  }

  try {
    revalidatePath('/[locale]/blog', 'page')
    revalidatePath('/[locale]/blog/[slug]', 'page')
    revalidatePath('/[locale]', 'page')
    revalidateTag('posts', { expire: 0 })
    return NextResponse.json({ result: true })
  } catch (error) {
    console.error('[api/admin/posts/revalidate]', error)
    return NextResponse.json({ error: '重新驗證失敗' }, { status: 500 })
  }
}
