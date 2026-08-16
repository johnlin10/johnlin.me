'use client'

import { useTranslations } from 'next-intl'
import type { PhotoTakenAtPrecision } from '@/app/types/photo'
import Input from '@/app/components/admin/Input/Input'
import Button from '@/app/components/admin/Button/Button'
import DropdownSelect from '@/app/components/admin/Selector/DropdownSelect'
import Icon from '@/app/components/Icon/Icon'
import type { StagedPhoto } from './stagedPhoto'
import style from './PhotoUpload.module.scss'

interface StagedPhotoRowProps {
  photo: StagedPhoto
  slugError?: string
  onChange: (patch: Partial<StagedPhoto>) => void
  onRemove: () => void
  onRetry: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * 預檢表的一列：縮圖、可編輯欄位、狀態。
 * uploading／processing／error 狀態下欄位一律唯讀 —— 傳輸中改資料只會讓
 * 使用者以為改到了，實際上早已用 confirm 那一刻的值送出。
 */
export default function StagedPhotoRow({
  photo,
  slugError,
  onChange,
  onRemove,
  onRetry,
}: StagedPhotoRowProps) {
  const t = useTranslations('AdminPage.photos.upload')
  // 欄位標籤跟檢閱欄（PhotoInspector）共用同一份翻譯，避免兩處各自維護
  // 幾乎一樣的字串。
  const tFields = useTranslations('AdminPage.photos.fields')
  const locked =
    photo.status === 'uploading' ||
    photo.status === 'processing' ||
    photo.status === 'done' ||
    photo.status === 'invalid'

  const precisionOptions: { value: PhotoTakenAtPrecision; label: string }[] = [
    { value: 'day', label: tFields('precisionDay') },
    { value: 'month', label: tFields('precisionMonth') },
    { value: 'year', label: tFields('precisionYear') },
  ]

  return (
    <div className={`${style.row} ${style[`row_${photo.status}`] ?? ''}`}>
      <div className={style.rowThumb}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.previewUrl} alt="" />
        {photo.isHdr && <span className={style.hdrBadge}>{tFields('hdr')}</span>}
      </div>

      <div className={style.rowBody}>
        <div className={style.rowHeader}>
          <div className={style.rowFileInfo}>
            <span className={style.rowFilename} title={photo.file.name}>
              {photo.file.name}
            </span>
            <span className={style.rowFilesize}>
              {formatBytes(photo.file.size)} · {photo.width}×{photo.height}
            </span>
          </div>

          {photo.status === 'reading' && (
            <span className={style.rowStatusText}>{t('reading')}</span>
          )}
          {(photo.status === 'uploading' || photo.status === 'processing') && (
            <span className={style.rowStatusText}>
              {photo.status === 'uploading'
                ? `${t('uploading')} ${Math.round(photo.progress * 100)}%`
                : t('processing')}
            </span>
          )}
          {photo.status === 'done' && (
            <span className={`${style.rowStatusText} ${style.rowStatusDone}`}>
              <Icon name="check" size="xs" /> {t('done')}
            </span>
          )}
          {photo.status === 'error' && (
            <span className={`${style.rowStatusText} ${style.rowStatusError}`}>
              <Icon name="triangle-exclamation" size="xs" /> {photo.error}
            </span>
          )}
          {photo.status === 'invalid' && (
            <span className={`${style.rowStatusText} ${style.rowStatusError}`}>
              <Icon name="triangle-exclamation" size="xs" /> {t('unreadable')}
            </span>
          )}

          {photo.status !== 'uploading' && photo.status !== 'processing' && (
            <div className={style.rowActions}>
              {photo.status === 'error' && (
                <Button size="small" variant="secondary" onClick={onRetry}>
                  {t('retry')}
                </Button>
              )}
              {photo.status !== 'done' && (
                <Button size="small" variant="ghost" onClick={onRemove}>
                  {t('remove')}
                </Button>
              )}
            </div>
          )}
        </div>

        {(photo.status === 'uploading' || photo.status === 'processing') && (
          <div className={style.progressTrack}>
            <div
              className={style.progressFill}
              style={{
                width:
                  photo.status === 'processing'
                    ? '100%'
                    : `${Math.round(photo.progress * 100)}%`,
              }}
            />
          </div>
        )}

        {photo.status !== 'invalid' && (
        <div className={style.rowFields}>
          <Input
            label={tFields('slug')}
            value={photo.slug}
            onChange={(value) => onChange({ slug: value })}
            error={slugError}
            disabled={locked}
          />

          <div className={style.rowDateGroup}>
            <Input
              label={tFields('date')}
              value={photo.takenAtLocal}
              onChange={(value) => onChange({ takenAtLocal: value, hasExifDate: true })}
              placeholder={tFields('datePlaceholder')}
              error={!photo.hasExifDate ? t('needsDate') : undefined}
              disabled={locked}
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

          <Input
            label={tFields('captionZh')}
            value={photo.captionZh}
            onChange={(value) => onChange({ captionZh: value })}
            disabled={locked}
          />
          <Input
            label={tFields('captionEn')}
            value={photo.captionEn}
            onChange={(value) => onChange({ captionEn: value })}
            disabled={locked}
          />
          <Input
            label={tFields('locationNameZh')}
            value={photo.locationNameZh}
            onChange={(value) => onChange({ locationNameZh: value })}
            disabled={locked}
          />
          <Input
            label={tFields('locationNameEn')}
            value={photo.locationNameEn}
            onChange={(value) => onChange({ locationNameEn: value })}
            disabled={locked}
          />
        </div>
        )}

        {photo.status !== 'invalid' && (photo.exif?.model || photo.exif?.lens) && (
          <p className={style.rowExif}>
            {photo.exif?.model && <span>{photo.exif.model}</span>}
            {photo.exif?.lens && <span>{photo.exif.lens}</span>}
          </p>
        )}

        {photo.status !== 'invalid' && photo.gps && (
          <label className={style.rowGps}>
            <input
              type="checkbox"
              checked={photo.includeGps}
              onChange={(e) => onChange({ includeGps: e.target.checked })}
              disabled={locked}
            />
            <span>{tFields('includeGps')}</span>
            {photo.includeGps && (
              <span className={style.rowGpsHelper}>
                {tFields('gpsHelper', {
                  lat: (Math.round(photo.gps.lat * 1000) / 1000).toFixed(3),
                  lng: (Math.round(photo.gps.lng * 1000) / 1000).toFixed(3),
                })}
              </span>
            )}
          </label>
        )}
      </div>
    </div>
  )
}
