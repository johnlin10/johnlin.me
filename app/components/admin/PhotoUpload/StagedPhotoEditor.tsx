'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Photo, PhotoTakenAtPrecision } from '@/app/types/photo'
import type { SupportedLocale } from '@/app/types/blog'
import { buildPhotoLocales } from '@/app/lib/photos/localeFields'
import { normalizeTakenAtLocal } from '@/app/lib/photos/exifDraft'
import PhotoMeta from '@/app/components/gallery/PhotoMeta/PhotoMeta'
import Input from '@/app/components/admin/Input/Input'
import Button from '@/app/components/admin/Button/Button'
import DropdownSelect from '@/app/components/admin/Selector/DropdownSelect'
import LocaleToggle from '@/app/components/admin/LocaleToggle/LocaleToggle'
import Icon from '@/app/components/Icon/Icon'
import type { StagedPhoto } from './stagedPhoto'
import style from './PhotoUpload.module.scss'

interface StagedPhotoEditorProps {
  photo: StagedPhoto
  slugError?: string
  editLocale: SupportedLocale
  onEditLocaleChange: (locale: SupportedLocale) => void
  onChange: (patch: Partial<StagedPhoto>) => void
  onRemove: () => void
  onRetry: () => void
  /** 後面還能被套用地名的張數；0 就不顯示「套用到後面」。 */
  applyCount: number
  onApplyLocation: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** PhotoMeta 吃完整的 Photo；還沒上傳的照片只有顯示會用到的欄位是真的。 */
function toPreviewPhoto(photo: StagedPhoto): Photo {
  return {
    id: photo.assetId,
    slug: photo.slug,
    derivatives: [],
    urlOriginal: photo.previewUrl,
    urlOg: '',
    originalMime: photo.file.type,
    originalBytes: photo.file.size,
    width: photo.width,
    height: photo.height,
    isHdr: photo.isHdr,
    takenAt: '',
    takenAtLocal: normalizeTakenAtLocal(photo.takenAtLocal, photo.takenAtPrecision),
    takenAtPrecision: photo.takenAtPrecision,
    exif: photo.exif,
    locales: buildPhotoLocales(photo),
    status: 'draft',
    createdAt: '',
    updatedAt: '',
  }
}

/**
 * 逐張填寫的一頁：左邊是照片跟前台會顯示的說明，右邊是欄位。
 * 中英文共用一組欄位、用 LocaleToggle 切換，跟照片頁的檢閱欄一致。
 * uploading／processing／done／invalid 時欄位唯讀 —— 送出用的是
 * 按下上傳那一刻的值，之後再改只會讓人以為改到了。
 */
export default function StagedPhotoEditor({
  photo,
  slugError,
  editLocale,
  onEditLocaleChange,
  onChange,
  onRemove,
  onRetry,
  applyCount,
  onApplyLocation,
}: StagedPhotoEditorProps) {
  const t = useTranslations('AdminPage.photos.upload')
  const tFields = useTranslations('AdminPage.photos.fields')
  const [editingSlug, setEditingSlug] = useState(false)

  const locked =
    photo.status === 'uploading' ||
    photo.status === 'processing' ||
    photo.status === 'done' ||
    photo.status === 'invalid'
  const isZh = editLocale === 'zh-tw'
  const caption = isZh ? photo.captionZh : photo.captionEn
  const locationName = isZh ? photo.locationNameZh : photo.locationNameEn
  const hasLocation = Boolean(photo.locationNameZh.trim() || photo.locationNameEn.trim())

  const precisionOptions: { value: PhotoTakenAtPrecision; label: string }[] = [
    { value: 'day', label: tFields('precisionDay') },
    { value: 'month', label: tFields('precisionMonth') },
    { value: 'year', label: tFields('precisionYear') },
  ]

  return (
    <div className={style.editor}>
      <div className={style.stage}>
        <div className={style.print}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.previewUrl} alt="" />
          {photo.isHdr && <span className={style.hdrBadge}>{tFields('hdr')}</span>}
        </div>
        {photo.status !== 'reading' && photo.status !== 'invalid' && (
          <PhotoMeta
            photo={toPreviewPhoto(photo)}
            locale={editLocale}
            as="div"
          />
        )}
      </div>

      <div className={style.panel}>
        {photo.status === 'reading' && (
          <p className={style.statusText}>{t('reading')}</p>
        )}
        {(photo.status === 'uploading' || photo.status === 'processing') && (
          <p className={style.statusText}>
            {photo.status === 'uploading'
              ? `${t('uploading')} ${Math.round(photo.progress * 100)}%`
              : t('processing')}
          </p>
        )}
        {photo.status === 'done' && (
          <p className={`${style.statusText} ${style.statusDone}`}>
            <Icon name="check" size="xs" /> {t('done')}
          </p>
        )}
        {photo.status === 'error' && (
          <div className={style.statusRow}>
            <p className={`${style.statusText} ${style.statusError}`}>
              <Icon name="triangle-exclamation" size="xs" /> {photo.error}
            </p>
            <Button size="small" variant="secondary" onClick={onRetry}>
              {t('retry')}
            </Button>
          </div>
        )}
        {photo.status === 'invalid' && (
          <p className={`${style.statusText} ${style.statusError}`}>
            <Icon name="triangle-exclamation" size="xs" /> {t('unreadable')}
          </p>
        )}

        {photo.status !== 'invalid' && (
          <>
            <LocaleToggle
              value={editLocale}
              onChange={onEditLocaleChange}
              filled={{
                'zh-tw': Boolean(photo.captionZh.trim() || photo.locationNameZh.trim()),
                en: Boolean(photo.captionEn.trim() || photo.locationNameEn.trim()),
              }}
            />

            <Input
              label={tFields('caption')}
              value={caption}
              onChange={(value) =>
                onChange(isZh ? { captionZh: value } : { captionEn: value })
              }
              disabled={locked}
              compact
            />

            <div className={style.fieldWithAction}>
              <Input
                label={tFields('locationName')}
                value={locationName}
                onChange={(value) =>
                  onChange(isZh ? { locationNameZh: value } : { locationNameEn: value })
                }
                disabled={locked}
                compact
              />
              {applyCount > 0 && hasLocation && !locked && (
                <button type="button" className={style.textAction} onClick={onApplyLocation}>
                  {t('applyLocation', { count: applyCount })}
                </button>
              )}
            </div>

            <div className={style.dateGroup}>
              <Input
                label={tFields('date')}
                value={photo.takenAtLocal}
                onChange={(value) => onChange({ takenAtLocal: value, hasExifDate: true })}
                placeholder={tFields('datePlaceholder')}
                error={!photo.hasExifDate ? t('needsDate') : undefined}
                disabled={locked}
                compact
              />
              <DropdownSelect
                value={photo.takenAtPrecision}
                onChange={(value) =>
                  onChange({ takenAtPrecision: value as PhotoTakenAtPrecision })
                }
                options={precisionOptions}
                placeholder={tFields('precisionDay')}
                clearable={false}
                compact
                disabled={locked}
              />
            </div>

            {photo.gps && (
              <label className={style.gpsRow}>
                <input
                  type="checkbox"
                  checked={photo.includeGps}
                  onChange={(e) => onChange({ includeGps: e.target.checked })}
                  disabled={locked}
                />
                <span>{tFields('includeGps')}</span>
                {photo.includeGps && (
                  <span className={style.gpsHelper}>
                    {tFields('gpsHelper', {
                      lat: (Math.round(photo.gps.lat * 1000) / 1000).toFixed(3),
                      lng: (Math.round(photo.gps.lng * 1000) / 1000).toFixed(3),
                    })}
                  </span>
                )}
              </label>
            )}

            {editingSlug || slugError ? (
              <Input
                label={tFields('slug')}
                value={photo.slug}
                onChange={(value) => onChange({ slug: value })}
                error={slugError}
                disabled={locked}
                compact
              />
            ) : (
              <dl className={style.facts}>
                <div className={style.factRow}>
                  <dt>{t('url')}</dt>
                  <dd>
                    <span className={style.slugText}>/photography/{photo.slug}</span>
                    {!locked && photo.slug && (
                      <button
                        type="button"
                        className={style.textAction}
                        onClick={() => setEditingSlug(true)}
                      >
                        {t('editSlug')}
                      </button>
                    )}
                  </dd>
                </div>
              </dl>
            )}
          </>
        )}

        <dl className={style.facts}>
          <div className={style.factRow}>
            <dt>{t('original')}</dt>
            <dd>
              {photo.width > 0 && `${photo.width} × ${photo.height} · `}
              {formatBytes(photo.file.size)}
            </dd>
          </div>
          <div className={style.factRow}>
            <dt>{t('fileName')}</dt>
            <dd className={style.fileName} title={photo.file.name}>
              {photo.file.name}
            </dd>
          </div>
        </dl>

        {photo.status !== 'uploading' &&
          photo.status !== 'processing' &&
          photo.status !== 'done' && (
            <div className={style.removeRow}>
              <Button size="small" variant="ghost" onClick={onRemove}>
                {t('removeThis')}
              </Button>
            </div>
          )}
      </div>
    </div>
  )
}
