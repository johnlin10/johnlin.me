'use client'

import { useTranslations } from 'next-intl'
import type { Photo } from '@/app/types/photo'
import type { SupportedLocale } from '@/app/types/blog'
import {
  formatExifItems,
  formatTakenAt,
  photoCaption,
  photoLocationName,
} from '@/app/lib/photos/format'
import PhotoMap from './PhotoMap'
import styles from './PhotoMeta.module.scss'

interface PhotoMetaProps {
  photo: Photo
  locale: SupportedLocale
  /**
   * as='figcaption' 給單張頁的語意結構；as='div' 給牆上／燈箱的資訊卡。
   * 預設 figcaption。
   */
  as?: 'figcaption' | 'div'
  /** heading 為 true 時 caption 用 <h1>（單張頁只該有一個 h1）。 */
  heading?: boolean
  /** 相機參數。首頁一瞥只給辨識用的最小資訊，其餘留給單張頁。 */
  showExif?: boolean
  /** 有公開座標時，地點變成可打開地圖的按鈕。 */
  showMap?: boolean
  className?: string
}

/**
 * 照片資訊卡：標題（caption）、拍攝日期、地點、相機參數。
 * 單張頁的 figcaption 與牆上／燈箱卡片共用同一份 markup。
 * Client component（用 next-intl 的 client hook 取無障礙標籤），
 * 在 server page 中仍會 SSR 出完整 HTML，SEO 不受影響。
 */
export default function PhotoMeta({
  photo,
  locale,
  as = 'figcaption',
  heading = false,
  showExif = true,
  showMap = true,
  className,
}: PhotoMetaProps) {
  const t = useTranslations('GalleryPage')

  const caption = photoCaption(photo, locale)
  const location = photoLocationName(photo, locale)
  const date = formatTakenAt(
    photo.takenAtLocal,
    photo.takenAtPrecision,
    locale
  )
  const exifItems = formatExifItems(photo.exif)
  const coords = showMap ? photo.location : undefined

  const Tag = as
  const titleText = caption || location || date

  return (
    <Tag
      className={[styles.meta, className]
        .filter(Boolean)
        .join(' ')}
    >
      {heading ? (
        <h1 className={styles.title}>{titleText}</h1>
      ) : (
        caption && <p className={styles.title}>{caption}</p>
      )}

      <dl className={styles.fields}>
        <div className={styles.field}>
          <dt className={styles.srOnly}>{t('meta.date')}</dt>
          <dd>
            <time dateTime={photo.takenAtLocal.slice(0, 10)}>{date}</time>
          </dd>
        </div>

        {(location || coords) && (
          <div className={styles.field}>
            <dt className={styles.srOnly}>{t('meta.location')}</dt>
            <dd>
              {coords ? <PhotoMap location={coords} label={location} /> : location}
            </dd>
          </div>
        )}
      </dl>

      {showExif && exifItems.length > 0 && (
        <dl className={styles.exif}>
          {exifItems.map((item) => (
            <div key={item.key} className={styles.field}>
              <dt className={styles.srOnly}>{t(`exif.${item.key}`)}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </Tag>
  )
}
