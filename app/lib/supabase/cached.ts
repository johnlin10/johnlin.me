import { unstable_cache } from 'next/cache'
import { createPublicClient } from './public'
import { getLatestPosts } from './posts'
import type { Post } from '@/app/types/blog'

/**
 * 首頁用的最新文章，跨請求快取 5 分鐘（tag: 'posts'）。
 * 發文後若要即時反映，可在寫入端呼叫 revalidateTag('posts', 'max')（Next 16 起需要第二個 cacheLife 參數）。
 */
export const getCachedLatestPosts = unstable_cache(
  async (limit: number): Promise<Post[]> => {
    const supabase = createPublicClient()
    return getLatestPosts(supabase, limit)
  },
  ['home-latest-posts'],
  { revalidate: 300, tags: ['posts'] }
)
