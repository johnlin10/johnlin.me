import type { Photo } from '@/app/types/photo'
import type { SupportedLocale } from '@/app/types/blog'
import { SITE_CONFIG } from '@/app/lib/siteConfigs'
import {
  photoAltText,
  photoCaption,
  photoLocationName,
} from '@/app/lib/photos/format'

interface PhotoJsonLdProps {
  photo: Photo
  locale: SupportedLocale
  /** 該照片的正式頁面網址（含語系前綴），供 mainEntityOfPage 使用 */
  pageUrl: string
}

/**
 * schema.org Photograph 結構化資料。爬蟲與圖片搜尋靠這個理解單張作品，
 * 一份 markup 就把作者、拍攝時間、地點、內容描述交代清楚。
 */
export default function PhotoJsonLd({
  photo,
  locale,
  pageUrl,
}: PhotoJsonLdProps) {
  const caption = photoCaption(photo, locale)
  const location = photoLocationName(photo, locale)
  const creator = locale === 'en' ? SITE_CONFIG.creator.en : SITE_CONFIG.creator.zh_tw

  // 取最大的衍生檔當 contentUrl（搜尋引擎要的是可直接顯示的圖）
  const largest = photo.derivatives.at(-1)?.url ?? photo.urlOriginal

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Photograph',
    '@id': pageUrl,
    mainEntityOfPage: pageUrl,
    contentUrl: largest,
    thumbnailUrl: photo.derivatives[0]?.url ?? largest,
    width: photo.width,
    height: photo.height,
    name: caption || location || photo.slug,
    description: photoAltText(photo, locale),
    creator: { '@type': 'Person', name: creator },
    copyrightHolder: { '@type': 'Person', name: creator },
    dateCreated: photo.takenAtLocal,
  }
  if (location) jsonLd.contentLocation = { '@type': 'Place', name: location }
  if (photo.location) {
    jsonLd.contentLocation = {
      '@type': 'Place',
      ...(location ? { name: location } : {}),
      geo: {
        '@type': 'GeoCoordinates',
        latitude: photo.location.lat,
        longitude: photo.location.lng,
      },
    }
  }

  return (
    <script
      type="application/ld+json"
      // JSON.stringify 的輸出對 script 內容安全（無使用者可注入的 </script>）；
      // caption/location 由後台管理員填寫，非公開輸入。
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
