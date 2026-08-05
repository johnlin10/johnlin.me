import { createClient } from '@/app/lib/supabase/server'
import { getPublishedNotes } from '@/app/lib/supabase/notes'
import { rssDocument, SITE_URL } from '@/app/lib/rss'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: notes } = await getPublishedNotes(supabase, { pageSize: 50 })

  const xml = rssDocument({
    title: 'John Lin — 短文',
    link: `${SITE_URL}/notes`,
    description: '林昌龍的生活短文與隨手記錄。',
    selfUrl: `${SITE_URL}/rss/notes.xml`,
    items: notes.map((n) => {
      const url = `${SITE_URL}/notes/${n.id}`
      const firstLine = n.content.split('\n')[0] || '短文'
      return {
        title: firstLine.slice(0, 50),
        link: url,
        guid: url,
        pubDate: new Date(n.publishedAt ?? n.createdAt).toUTCString(),
        description: n.content,
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
