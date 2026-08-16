import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/app/lib/supabase/requireAdmin'

/**
 * 兩個 gallery 路由都是 revalidate = 300，發布或退回發布之後不打這支的話，
 * 使用者最多要等 5 分鐘才會看到變化 —— 而「我按了發布但網站沒變」看起來
 * 就是個 bug，會白白燒掉排查的時間。
 *
 * 傳路由樣板（含中括號的動態區段）而不是某一張照片的具體網址：
 * revalidatePath 對 'page' 類型的樣板會讓整個動態路由失效，不需要、
 * 也不必知道是哪個 slug。
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
    revalidatePath('/[locale]/gallery', 'page')
    revalidatePath('/[locale]/gallery/[slug]', 'page')
    return NextResponse.json({ result: true })
  } catch (error) {
    console.error('[api/admin/photos/revalidate]', error)
    return NextResponse.json({ error: '重新驗證失敗' }, { status: 500 })
  }
}
