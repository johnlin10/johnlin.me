'use client'

import { useTranslations } from 'next-intl'
import Icon from '@/app/components/Icon/Icon'
import DropZone from './DropZone'
import type { StagedPhoto } from './stagedPhoto'
import style from './PhotoUpload.module.scss'

interface FilmstripProps {
  photos: StagedPhoto[]
  currentId: string
  /** 有問題（缺日期、slug 不合法、讀檔或上傳失敗）的照片，縮圖上標黃。 */
  problemIds: Set<string>
  onSelect: (localId: string) => void
  onFiles: (files: File[]) => void
}

/** 底部的縮圖列：跳到任一張、看哪張有問題，最後一格加入更多照片。 */
export default function Filmstrip({
  photos,
  currentId,
  problemIds,
  onSelect,
  onFiles,
}: FilmstripProps) {
  const t = useTranslations('AdminPage.photos.upload')

  return (
    <div className={style.filmstrip}>
      {photos.map((photo, i) => (
        <button
          key={photo.localId}
          type="button"
          className={`${style.filmThumb} ${photo.localId === currentId ? style.filmCurrent : ''}`}
          onClick={() => onSelect(photo.localId)}
          aria-label={t('stepOf', { current: i + 1, total: photos.length })}
          aria-current={photo.localId === currentId ? 'step' : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.previewUrl} alt="" />
          {photo.status === 'done' ? (
            <span className={`${style.filmMark} ${style.filmMarkDone}`}>
              <Icon name="check" size="xs" />
            </span>
          ) : (
            problemIds.has(photo.localId) && (
              <span className={`${style.filmMark} ${style.filmMarkWarn}`}>
                <Icon name="triangle-exclamation" size="xs" />
              </span>
            )
          )}
        </button>
      ))}
      <DropZone onFiles={onFiles} compact />
    </div>
  )
}
