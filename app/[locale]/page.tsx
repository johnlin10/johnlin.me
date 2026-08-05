import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getTranslations } from 'next-intl/server'
import Hero from '@/app/components/home/Hero'
import WhoAmI from '@/app/components/home/WhoAmI'
import ThreeThings from '@/app/components/home/ThreeThings'
import FeaturedWorks from '@/app/components/home/FeaturedWorks'
import LatestArticles from '@/app/components/home/LatestArticles'
import PhotographyGlimpse from '@/app/components/home/PhotographyGlimpse'
import { getCachedLatestPosts } from '@/app/lib/supabase/cached'
import type { SupportedLocale } from '@/app/types/blog'

// 首頁使用 ISR：內容變動不頻繁，以快取提升載入速度（最新文章另有 5 分鐘資料快取）。
export const revalidate = 300

type Props = {
  params: Promise<{
    locale: string
  }>
}

import { metadata } from '@/app/lib/metadata'

export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'HomePage' })

  return metadata({
    title: 'John Lin | 林昌龍',
    description: t('description'),
    url: '/',
    appendSiteName: false,
  })
}

/**
 * 將 TipTap 輸出的 HTML 內文轉純文字
 * 供 Hero 紙張下半部填充預覽
 * @param html
 * @returns 純文字內容
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Hero 的「程式」面板直接展示畫出它自己的原始碼
 * 只讀檔案，不是 module import，沒有循環依賴問題
 * @returns 程式碼內容
 */
async function getShowcaseSource() {
  try {
    const filePath = path.join(
      process.cwd(),
      'app/components/home/HeroShowcase.tsx',
    )
    const raw = await readFile(filePath, 'utf-8')
    // 只送前 200 行控制傳輸量，實際上早就超過顯示范圍，這裡純粹是 payload 保險。
    return raw.split('\n').slice(0, 200).join('\n')
  } catch {
    return '// 原始碼讀取失敗，請稍後再試...\n'
  }
}

export default async function Home({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'HomePage' })
  const sourceCode = await getShowcaseSource()

  // 最新 3 篇（快取共用）：同時給 Hero 紙堆與下方「最新文章」，只查一次
  const latestPosts = await getCachedLatestPosts(3).catch(() => [])
  const loc = locale as SupportedLocale
  const heroPapers = latestPosts.map((p) => {
    const c = p.locales[loc]?.title ? p.locales[loc] : p.locales['zh-tw']
    // 內文優先（扒出正文填滿紙張），無正文時退回摘要。
    const body = htmlToPlainText(c.content ?? '')
    return {
      title: c.title,
      excerpt: body || c.description,
      date: new Date(p.publishedAt ?? p.createdAt).toLocaleDateString(
        loc === 'zh-tw' ? 'zh-TW' : 'en-US',
        { year: 'numeric', month: 'long', day: 'numeric' },
      ),
    }
  })

  return (
    <main>
      <Hero
        tagline={t('tagline')}
        role={t('role')}
        scrollHint={t('hero.scrollHint')}
        sourceCode={sourceCode}
        papers={heroPapers}
      />
      <WhoAmI locale={locale} />
      <ThreeThings locale={locale} />
      <FeaturedWorks locale={locale} />
      <LatestArticles locale={locale} posts={latestPosts} />
      <PhotographyGlimpse locale={locale} />
    </main>
  )
}
