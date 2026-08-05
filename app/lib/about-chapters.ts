import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { cache } from 'react'
import { routing } from '@/i18n/routing'
import { parseFrontmatter } from './frontmatter'

const CONTENT_DIR = path.join(process.cwd(), 'content/about')
const FILE_RE = /^([a-z0-9-]+)\.(en|zh-tw)\.md$/

export interface AboutChapter {
  id: string
  title: string
  order: number
  body: string
  isFallbackLocale: boolean
}

async function readChapterFile(slug: string, locale: string) {
  return readFile(path.join(CONTENT_DIR, `${slug}.${locale}.md`), 'utf-8').catch(
    () => null
  )
}

// cache()：generateMetadata 與頁面本體在同一次請求內只會實際讀檔一次。
export const getAboutChapters = cache(
  async (locale: string): Promise<AboutChapter[]> => {
    const fallbackLocale = routing.defaultLocale // 'zh-tw'

    const files = await readdir(CONTENT_DIR).catch(() => [] as string[])
    const slugs = [
      ...new Set(
        files
          .map((file) => FILE_RE.exec(file)?.[1])
          .filter((slug): slug is string => Boolean(slug))
      ),
    ]

    const loaded = await Promise.all(
      slugs.map(async (slug) => {
        let usedLocale = locale
        let raw = await readChapterFile(slug, locale)

        if (raw === null && locale !== fallbackLocale) {
          usedLocale = fallbackLocale
          raw = await readChapterFile(slug, fallbackLocale)
        }
        if (raw === null) return null

        const { data, body } = parseFrontmatter(raw)
        const id = String(data.id ?? slug)
        const title = data.title !== undefined ? String(data.title) : ''

        // 開發期大聲失敗，避免同一章的中英檔案 id 漂移而裂成兩章；
        // 正式站則安靜跳過該章，不讓整頁掛掉。
        if (process.env.NODE_ENV !== 'production') {
          if (id !== slug) {
            throw new Error(
              `[about] ${slug}.${usedLocale}.md 的 frontmatter id "${id}" 與檔名不符`
            )
          }
          if (!title) {
            throw new Error(`[about] ${slug}.${usedLocale}.md 缺少 title`)
          }
        }
        if (id !== slug || !title) return null

        const chapter: AboutChapter = {
          id,
          title,
          order: Number(data.order ?? 999),
          body,
          isFallbackLocale: usedLocale !== locale,
        }
        return chapter
      })
    )

    return loaded
      .filter((chapter): chapter is AboutChapter => chapter !== null)
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  }
)
