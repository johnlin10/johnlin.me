import { SITE_CONFIG } from './siteConfigs'

const AVATAR = `${SITE_CONFIG.url}/assets/images/johnlin.jpeg`
const SAME_AS = ['https://github.com/johnlin10', 'https://johnlin10.substack.com']

/** 站主人物 schema，各頁共用（作為 WebSite.publisher 與文章 author）。 */
export function personJsonLd() {
  return {
    '@type': 'Person',
    name: 'John Lin',
    alternateName: '林昌龍',
    url: SITE_CONFIG.url,
    image: AVATAR,
    sameAs: SAME_AS,
  }
}

/** 網站層級 schema，放在根 layout，每頁都會帶到。 */
export function websiteJsonLd(locale: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_CONFIG.name.zh_tw,
    url: SITE_CONFIG.url,
    inLanguage: locale === 'en' ? 'en-US' : 'zh-TW',
    publisher: personJsonLd(),
  }
}

/** 文章頁 schema，讓 Google 有機會顯示作者、發布日期等 rich result。 */
export function blogPostingJsonLd({
  title,
  description,
  image,
  url,
  datePublished,
  dateModified,
  locale,
}: {
  title: string
  description: string
  image?: string
  url: string
  datePublished?: string
  dateModified?: string
  locale: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    ...(image && { image }),
    url,
    inLanguage: locale === 'en' ? 'en-US' : 'zh-TW',
    ...(datePublished && { datePublished }),
    ...(dateModified && { dateModified }),
    author: personJsonLd(),
    publisher: personJsonLd(),
  }
}
