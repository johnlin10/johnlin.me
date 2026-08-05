// 極簡 RSS 2.0 產生器（無外部依賴）。

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export interface RssItem {
  title: string
  link: string
  guid: string
  pubDate: string // UTC 字串
  description: string
}

export function rssDocument(opts: {
  title: string
  link: string
  description: string
  selfUrl: string
  items: RssItem[]
}): string {
  const items = opts.items
    .map(
      (it) =>
        `    <item>\n` +
        `      <title>${escapeXml(it.title)}</title>\n` +
        `      <link>${escapeXml(it.link)}</link>\n` +
        `      <guid isPermaLink="true">${escapeXml(it.guid)}</guid>\n` +
        `      <pubDate>${it.pubDate}</pubDate>\n` +
        `      <description>${escapeXml(it.description)}</description>\n` +
        `    </item>`
    )
    .join('\n')

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
    `  <channel>\n` +
    `    <title>${escapeXml(opts.title)}</title>\n` +
    `    <link>${escapeXml(opts.link)}</link>\n` +
    `    <description>${escapeXml(opts.description)}</description>\n` +
    `    <language>zh-TW</language>\n` +
    `    <atom:link href="${escapeXml(opts.selfUrl)}" rel="self" type="application/rss+xml" />\n` +
    `${items}\n` +
    `  </channel>\n` +
    `</rss>\n`
  )
}

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://johnlin.me'
).replace(/\/$/, '')
