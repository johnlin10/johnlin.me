import { createClient } from '@/app/lib/supabase/server'
import { getSeries } from '@/app/lib/supabase/series'
import SeriesTool from './SeriesTool'

/**
 * 系列管理。首屏資料在伺服器端抓，function 跟 Supabase 同在東京。
 */
export default async function SeriesPage() {
  const initial = await getSeries(await createClient()).catch(() => null)
  return <SeriesTool initial={initial} />
}
