import { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { SITE_CONFIG } from './siteConfigs'

//* metadata 函數選項介面
export interface MetadataOptions {
  title: string
  description: string
  keywords?: string[]
  image?: string
  url?: string
  type?: 'website' | 'article' | 'profile'
  publishedTime?: string
  modifiedTime?: string
  authors?: Array<{ name: string; url?: string }>
  category?: string
  noIndex?: boolean
  /** 是否在標題後方加上「 | 站主名」。預設 true，後台頁面應設為 false，維持功能描述即可。 */
  appendSiteName?: boolean
}

/**
 * 生成完整的頁面 metadata
 * @param options - metadata 選項物件
 * @param options.title - 頁面標題
 * @param options.description - 頁面描述
 * @param options.keywords - 頁面關鍵字
 * @param options.image - 頁面圖片
 * @param options.url - 頁面網址
 * @param options.type - 頁面類型
 * @param options.publishedTime - 頁面發布時間
 * @param options.modifiedTime - 頁面修改時間
 * @param options.authors - 頁面作者
 * @param options.category - 頁面分類
 * @param options.noIndex - 是否禁止搜索引擎索引
 * @param options.appendSiteName - 是否在標題後方加上「 | 站主名」，預設 true
 * @returns 完整的 Next.js Metadata 物件
 *
 * @example
 * ```tsx
 * export async function generateMetadata() {
 *   return metadata({
 *     title: '關於我', // 自動變成「關於我 | 林昌龍」
 *     description: '了解 John Lin 的經歷與背景',
 *     keywords: ['關於我', '個人介紹'],
 *     category: 'about'
 *   })
 * }
 * ```
 */
export async function metadata(options: MetadataOptions): Promise<Metadata> {
  const locale = await getLocale().catch(() => 'zh-TW')
  const isEn = locale === 'en'

  const siteName = isEn ? SITE_CONFIG.name.en : SITE_CONFIG.name.zh_tw
  const siteShortName = isEn
    ? SITE_CONFIG.shortName.en
    : SITE_CONFIG.shortName.zh_tw
  const siteCreator = isEn ? SITE_CONFIG.creator.en : SITE_CONFIG.creator.zh_tw
  const sitePublisher = isEn
    ? SITE_CONFIG.publisher.en
    : SITE_CONFIG.publisher.zh_tw

  const {
    title: rawTitle,
    description,
    keywords = [],
    image = '/assets/image/metadata-backgrounds/global.webp',
    url,
    type = 'website',
    publishedTime,
    modifiedTime,
    authors,
    category,
    noIndex = false,
    appendSiteName = true,
  } = options

  const title = appendSiteName ? `${rawTitle} | ${siteCreator}` : rawTitle

  // zh-TW canonical (no prefix): /about → https://johnlin.me/about
  const zhPath = url === '/' ? '' : (url ?? '')
  const zhUrl = `${SITE_CONFIG.url}${zhPath}`

  // en canonical (/en prefix): /about → https://johnlin.me/en/about
  const enUrl = `${SITE_CONFIG.url}/en${zhPath}`

  // current locale's canonical URL
  const canonicalUrl = isEn ? enUrl : zhUrl

  const imageUrl = image.startsWith('http')
    ? image
    : `${SITE_CONFIG.url}${image}`
  const allKeywords = [...SITE_CONFIG.keywords, ...keywords]

  return {
    //* 基本頁面資訊
    title,
    description,
    applicationName: siteName,

    //* SEO 相關
    keywords: allKeywords,
    authors: authors || [{ name: siteCreator }],
    creator: siteCreator,
    publisher: sitePublisher,
    generator: 'Next.js',
    category,

    //* 搜尋引擎設定
    robots: noIndex
      ? { index: false, follow: false, nocache: true }
      : { index: true, follow: true, googleBot: { index: true, follow: true } },

    //* 網站驗證 (可依需求添加)
    verification: {
      // google: 'your-google-verification-code',
      // yandex: 'your-yandex-verification-code',
    },

    //* 規範化 URL 和替代語言
    alternates: {
      canonical: canonicalUrl,
      languages: {
        'zh-TW': zhUrl,
        en: enUrl,
        'x-default': zhUrl,
      },
    },

    //* Open Graph metadata
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: siteName,
      locale: isEn ? 'en_US' : 'zh_TW',
      type,
      images: [
        {
          url: imageUrl,
          width: 1920,
          height: 1080,
          alt: title,
        },
      ],
      ...(publishedTime && { publishedTime }),
      ...(modifiedTime && { modifiedTime }),
      ...(authors && { authors: authors.map((author) => author.name) }),
    },

    //* Twitter metadata
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },

    //* 其他 metadata
    formatDetection: {
      telephone: false,
      email: false,
      address: false,
    },

    //* Apple Web App 設定
    appleWebApp: {
      capable: true,
      title: siteShortName,
      statusBarStyle: 'default',
    },

    //* 其他自訂 metadata
    other: {
      'mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-status-bar-style': 'default',
    },
  }
}

/**
 * 將 CompetitionDateTime 轉換為 ISO 8601 格式
 * @param dateTime - CompetitionDateTime 物件
 * @returns ISO 8601 格式的日期時間字串，或 undefined
 */
export function formatDateTimeToISO(dateTime?: {
  date: string | null
  time: string | null
}): string | undefined {
  if (!dateTime?.date) return undefined

  const timeStr = dateTime.time || '00:00'
  const isoString = `${dateTime.date}T${timeStr}:00+08:00`

  // 驗證格式是否正確
  try {
    new Date(isoString)
    return isoString
  } catch {
    return undefined
  }
}

/**
 * 將 Firebase Timestamp 轉換為 ISO 8601 格式
 * @param timestamp - Firebase Timestamp 物件
 * @returns ISO 8601 格式的日期時間字串，或 undefined
 */
export function formatFirebaseTimestampToISO(
  timestamp?: string | { toDate?: () => Date },
): string | undefined {
  if (!timestamp) return undefined
  if (typeof timestamp === 'string') return timestamp
  if (!timestamp.toDate) return undefined

  try {
    return timestamp.toDate().toISOString()
  } catch {
    return undefined
  }
}

/**
 * 從 Markdown 內容生成 SEO 友善的描述
 * @param markdown - Markdown 格式的內容
 * @param maxLength - 最大長度，預設 160 字元
 * @returns 清理過的描述文字
 */
export function generateDescriptionFromMarkdown(
  markdown: string,
  maxLength: number = 160,
): string {
  if (!markdown) return ''

  return (
    markdown
      .replace(/#{1,6}\s+/g, '') // 移除標題
      .replace(/\*\*(.+?)\*\*/g, '$1') // 移除粗體
      .replace(/\*(.+?)\*/g, '$1') // 移除斜體
      .replace(/`(.+?)`/g, '$1') // 移除行內程式碼
      .replace(/```[\s\S]*?```/g, '') // 移除程式碼區塊
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // 移除連結，保留文字
      .replace(/!\[.*?\]\(.+?\)/g, '') // 移除圖片
      .replace(/^\s*[-*+]\s+/gm, '') // 移除清單符號
      .replace(/^\s*\d+\.\s+/gm, '') // 移除有序清單
      .replace(/^\s*>\s+/gm, '') // 移除引用
      .replace(/---+/g, '') // 移除分隔線
      .replace(/\n+/g, ' ') // 將換行替換為空格
      .replace(/\s+/g, ' ') // 合併多個空格
      .trim()
      .substring(0, maxLength) + (markdown.length > maxLength ? '...' : '')
  )
}

/**
 * 簡化版 metadata 函數 (向後相容)
 * @param title - 頁面標題
 * @param description - 頁面描述
 * @returns 基本的 metadata 物件
 * @deprecated 建議使用完整版的 metadata 函數
 */
export async function basicMetadata(
  title: string,
  description: string,
): Promise<Metadata> {
  return metadata({ title, description })
}
