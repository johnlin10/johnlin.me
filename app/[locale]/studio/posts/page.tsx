import { createClient } from '@/app/lib/supabase/server'
import { getPostsForAdmin } from '@/app/lib/supabase/posts'
import { getCategories } from '@/app/lib/supabase/categories'
import { getTags } from '@/app/lib/supabase/tags'
import PostsTool from './PostsTool'

/**
 * 文章列表。首屏資料在伺服器端抓，function 跟 Supabase 同在東京。
 */
export default async function PostsPage() {
  const supabase = await createClient()
  const initial = await Promise.all([
    getPostsForAdmin(supabase),
    getCategories(supabase),
    getTags(supabase),
  ])
    .then(([posts, categories, tags]) => ({ posts, categories, tags }))
    .catch(() => null)
  return <PostsTool initial={initial} />
}
