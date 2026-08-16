import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/supabase/requireAdmin'
import { revalidateGallery } from '@/app/lib/photos/revalidateGallery'

/**
 * 兩個 gallery 路由都是 revalidate = 300，發布或退回發布之後不打這支的話，
 * 使用者最多要等 5 分鐘才會看到變化 —— 而「我按了發布但網站沒變」看起來
 * 就是個 bug，會白白燒掉排查的時間。
 *
 * 給瀏覽器端的檢閱欄用；伺服器端的路由（刪除、批次）直接呼叫
 * revalidateGallery()，不必繞一趟 HTTP。
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
    revalidateGallery()
    return NextResponse.json({ result: true })
  } catch (error) {
    console.error('[api/admin/photos/revalidate]', error)
    return NextResponse.json({ error: '重新驗證失敗' }, { status: 500 })
  }
}
