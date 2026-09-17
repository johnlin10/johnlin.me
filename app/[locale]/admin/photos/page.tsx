import { createClient } from '@/app/lib/supabase/server'
import { getPhotosForAdmin } from '@/app/lib/supabase/photos'
import PhotosTool from './PhotosTool'

/**
 * 攝影管理。首屏資料在伺服器端抓，function 跟 Supabase 同在東京。
 */
export default async function AdminPhotosPage() {
  const initial = await getPhotosForAdmin(await createClient()).catch(() => null)
  return <PhotosTool initial={initial} />
}
