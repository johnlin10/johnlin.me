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
  /** compact：牆上聚焦卡專用的較小級距（卡片會被牆 transform 放大，需壓小字級）。 */
  compact?: boolean
  /** 相機參數。首頁一瞥只給辨識用的最小資訊，其餘留給單張頁。 */
  showExif?: boolean
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
  compact = false,
  showExif = true,
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

  const Tag = as
  const titleText = caption || location || date

  return (
    <Tag
      className={[styles.meta, compact && styles.compact, className]
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

        {location && (
          <div className={styles.field}>
            <dt className={styles.srOnly}>{t('meta.location')}</dt>
            <dd>{location}</dd>
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
