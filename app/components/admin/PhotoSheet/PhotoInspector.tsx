'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import type { Photo } from '@/app/types/photo'
import type { SupportedLocale } from '@/app/types/blog'
import PhotoMeta from '@/app/components/gallery/PhotoMeta/PhotoMeta'
import Icon from '@/app/components/Icon/Icon'
import Button from '@/app/components/admin/Button/Button'
import style from './PhotoSheet.module.scss'

interface PhotoInspectorProps {
  photo: Photo
  locale: SupportedLocale
  onPrev: () => void
  onNext: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * 檢閱欄（唯讀版）。上半是前台會看到的樣子（直接借用 PhotoMeta，
 * 「後台看到的就是訪客會看到的」），下半是只有管理員需要的事實區——
 * 上傳後就不再變動的欄位，做成可編輯反而是陷阱，見 UpdatePhotoInput 的設計。
 *
 * Phase 6 會把說明／地名／狀態這些換成真正的輸入框，接上 useAutosave；
 * 這裡先不動版面結構，屆時只需要替換對應區塊。
 */
export default function PhotoInspector({
  photo,
  locale,
  onPrev,
  onNext,
}: PhotoInspectorProps) {
  const t = useTranslations('AdminPage.photos.inspector')
  const tStatus = useTranslations('AdminPage.photos.status')
  const preview = photo.derivatives.findLast((d) => d.w <= 1600) ?? photo.derivatives.at(-1)

  return (
    <div className={style.inspector}>
      <div className={style.inspectorNav}>
        <Button variant="ghost" size="small" onClick={onPrev}>
          <Icon name="arrow-left" size="xs" />
        </Button>
        <Button variant="ghost" size="small" onClick={onNext}>
          <Icon name="arrow-right" size="xs" />
        </Button>
      </div>

      <div className={style.inspectorPreview}>
        {/* 白邊要貼著照片實際渲染出來的尺寸、四邊等寬，所以 .inspectorPrint
            是縮到跟圖片一樣大的相框，不是撐滿 .inspectorPreview 的固定框——
            後者的話橫幅/直幅照片會因為 letterbox 留白不同而讓白邊看起來厚薄不一。
            不疊模糊底圖：檢閱欄的目的是看清構圖與邊緣，模糊底圖只會讓
            照片邊界跟背景混在一起。 */}
        <div className={style.inspectorPrint}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview?.url} alt="" />
        </div>
      </div>

      <PhotoMeta photo={photo} locale={locale} as="div" />

      <dl className={style.inspectorFacts}>
        <div className={style.factRow}>
          <dt>{t('slug')}</dt>
          <dd>
            <code className={style.slugCode}>{photo.slug}</code>
          </dd>
        </div>
        <div className={style.factRow}>
          <dt>{t('status')}</dt>
          <dd>
            <span
              className={`${style.statusPill} ${photo.status === 'published' ? style.statusPublished : style.statusDraft}`}
            >
              {tStatus(photo.status)}
            </span>
          </dd>
        </div>
        <div className={style.factRow}>
          <dt>{t('dimensions')}</dt>
          <dd>
            {photo.width} × {photo.height}
            {photo.isHdr && <span className={style.hdrTag}>HDR</span>}
          </dd>
        </div>
        <div className={style.factRow}>
          <dt>{t('fileSize')}</dt>
          <dd>{formatBytes(photo.originalBytes)}</dd>
        </div>
        {photo.location && (
          <div className={style.factRow}>
            <dt>{t('gps')}</dt>
            <dd>
              <Icon name="location-dot" size="xs" />
              {photo.location.lat}, {photo.location.lng}
              <span className={style.gpsPublicNote}>{t('gpsPublicNote')}</span>
            </dd>
          </div>
        )}
      </dl>

      {photo.status === 'published' && (
        <Link
          href={`/gallery/${photo.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className={style.openOnSite}
        >
          <Icon name="arrow-right" size="xs" />
          {t('openOnSite')}
        </Link>
      )}
    </div>
  )
}
