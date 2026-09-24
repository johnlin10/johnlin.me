import { createClient } from '@/app/lib/supabase/server'
import { getCategories } from '@/app/lib/supabase/categories'
import CategoriesTool from './CategoriesTool'

/**
 * 分類管理。首屏資料在伺服器端抓，function 跟 Supabase 同在東京。
 */
export default async function CategoriesPage() {
  const initial = await getCategories(await createClient()).catch(() => null)
  return <CategoriesTool initial={initial} />
}
