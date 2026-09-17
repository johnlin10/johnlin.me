import { createClient } from '@/app/lib/supabase/server'
import { getBootstrap } from '@/app/lib/supabase/schedule'
import ScheduleTool from './ScheduleTool'

/**
 * 課表工具。首屏資料在伺服器端抓：function 跟 Supabase 同在東京，比瀏覽器等 JS 啟動後再問快得多。
 */
export default async function SchedulePage() {
  const initial = await getBootstrap(await createClient()).catch(() => null)
  return <ScheduleTool initial={initial} />
}
