import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getTranslations } from 'next-intl/server'
import Hero from '@/app/components/home/Hero/Hero'
import WhoAmI from '@/app/components/home/WhoAmI/WhoAmI'
import ThreeThings from '@/app/components/home/ThreeThings/ThreeThings'
import FeaturedWorks from '@/app/components/home/FeaturedWorks/FeaturedWorks'
import LatestArticles from '@/app/components/home/LatestArticles/LatestArticles'
import PhotographyGlimpse from '@/app/components/home/PhotographyGlimpse/PhotographyGlimpse'
import { getCachedLatestPosts } from '@/app/lib/supabase/cached'
import type { SupportedLocale } from '@/app/types/blog'

// ISR 300s；最新文章另有 5 分鐘資料快取
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
 * 將 TipTap 輸出的 HTML 轉為純文字，供 Hero 紙張預覽使用。
 * @param html - TipTap 輸出的 HTML 字串
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
 * 讀取 HeroShowcase.tsx 原始碼供「程式」面板展示（讀檔而非 import，避免循環依賴）。
 * @returns 程式碼內容（前 200 行）
 */
async function getShowcaseSource() {
  try {
    const filePath = path.join(
      process.cwd(),
      'app/components/home/HeroShowcase/HeroShowcase.tsx',
    )
    const raw = await readFile(filePath, 'utf-8')
    return raw.split('\n').slice(0, 200).join('\n')
  } catch {
    return '// 原始碼讀取失敗，請稍後再試...\n'
  }
}

export default async function Home({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'HomePage' })
  const sourceCode = await getShowcaseSource()

  // 只查一次，同時給 Hero 紙堆與下方「最新文章」
  const latestPosts = await getCachedLatestPosts(3).catch(() => [])
  const loc = locale as SupportedLocale
  const heroPapers = latestPosts.map((p) => {
    const c = p.locales[loc]?.title ? p.locales[loc] : p.locales['zh-tw']
    // 優先用正文，無正文時退回摘要
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
