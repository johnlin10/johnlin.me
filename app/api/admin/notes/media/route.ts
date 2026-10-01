import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/app/lib/supabase/requireAdmin'
import { noteMediaDeletePrefix } from '@/app/lib/r2/keys'
import { deletePrefix } from '@/app/lib/r2/objects'

const requestBody = z.object({ urls: z.array(z.string()).max(100) })

/**
 * 刪除短文圖片（整個資料夾，原檔與小圖一起）或預覽卡封面。
 * 只認 notes/ 底下的網址，其他網址略過不刪。
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

  const prefixes = new Set(
    parsed.data.urls.flatMap((url) => noteMediaDeletePrefix(url) ?? [])
  )
  try {
    let removed = 0
    for (const prefix of prefixes) removed += await deletePrefix(prefix)
    return NextResponse.json({ result: { removed } })
  } catch (error) {
    console.error('[api/admin/notes/media]', error)
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 })
  }
}
