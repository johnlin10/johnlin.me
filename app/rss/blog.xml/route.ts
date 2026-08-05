import { createClient } from '@/app/lib/supabase/server'
import { getPublishedPosts } from '@/app/lib/supabase/posts'
import { rssDocument, SITE_URL } from '@/app/lib/rss'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: posts } = await getPublishedPosts(supabase, { pageSize: 30 })

  const xml = rssDocument({
    title: 'John Lin — 文章',
    link: `${SITE_URL}/blog`,
    description: '林昌龍的長文與思考。',
    selfUrl: `${SITE_URL}/rss/blog.xml`,
    items: posts.map((p) => {
      const c = p.locales['zh-tw']
      const url = `${SITE_URL}/blog/${p.slug}`
      return {
        title: c.title,
        link: url,
        guid: url,
        pubDate: new Date(p.publishedAt ?? p.createdAt).toUTCString(),
        description: c.description || '',
      }
    }),
  })

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate',
    },
  })
}
