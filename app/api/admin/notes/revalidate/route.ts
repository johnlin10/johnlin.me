import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/app/lib/supabase/requireAdmin'

/**
 * 短文列表與永久連結頁都是 revalidate = 300，後台寫入短文後打這支，
 * 發布、修改、刪除才會立刻反映在網站上。
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
    revalidatePath('/[locale]/notes', 'page')
    revalidatePath('/[locale]/notes/[id]', 'page')
    return NextResponse.json({ result: true })
  } catch (error) {
    console.error('[api/admin/notes/revalidate]', error)
    return NextResponse.json({ error: '重新驗證失敗' }, { status: 500 })
  }
}
