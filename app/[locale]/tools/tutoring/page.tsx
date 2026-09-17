import { createClient } from '@/app/lib/supabase/server'
import { getTutoring } from '@/app/lib/supabase/tutoring'
import TutoringTool from './TutoringTool'

/**
 * 完善就學管理頁。首屏資料在伺服器端抓，function 跟 Supabase 同在東京。
 */
export default async function TutoringPage() {
  // 伺服器是 UTC，這個月照台灣時間算；瀏覽器那邊的月份不一樣的話會自己再抓一次
  const month = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }).slice(0, 7)
  const initial = await getTutoring(await createClient(), month).catch(() => null)
  return <TutoringTool initial={initial} />
}
