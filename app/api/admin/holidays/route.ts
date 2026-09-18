import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/supabase/requireAdmin'
import { ICS_URL, parseHolidays } from '@/app/lib/holidays'

/**
 * 今年和明年的國定假日。學年跨兩個西元年，所以一次給兩年。
 */
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? '請先登入' : '沒有權限' },
      { status: auth.status },
    )
  }

  const thisYear = new Date().getFullYear()
  const years = [String(thisYear), String(thisYear + 1)]

  try {
    // 一天一次就夠，行事曆一年才更新一次
    const response = await fetch(ICS_URL, { next: { revalidate: 86_400 } })
    if (!response.ok) throw new Error(`ics ${response.status}`)
    return NextResponse.json({ days: parseHolidays(await response.text(), years) })
  } catch (error) {
    console.error('[api/admin/holidays] GET', error)
    return NextResponse.json({ error: '匯入失敗' }, { status: 502 })
  }
}
