'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import type { SupportedLocale } from '@/app/types/blog'
import { formatTakenAt } from '@/app/lib/photos/format'
import { normalizeTakenAtLocal } from '@/app/lib/photos/exifDraft'
import Button from '@/app/components/admin/Button/Button'
import Icon from '@/app/components/Icon/Icon'
import type { StagedPhoto } from './stagedPhoto'
import style from './PhotoUpload.module.scss'

interface UploadReviewProps {
  photos: StagedPhoto[]
  confirmableIds: Set<string>
  slugErrors: Record<string, string>
  running: boolean
  allDone: boolean
  onEdit: (localId: string) => void
  onBack: () => void
  onConfirm: () => void
  onCancel: () => void
  onClearAll: () => void
  onRetry: (localId: string) => void
}

/** 上傳前最後看一眼的清單，按下上傳後就地變成進度表。 */
export default function UploadReview({
  photos,
  confirmableIds,
  slugErrors,
  running,
  allDone,
  onEdit,
  onBack,
  onConfirm,
  onCancel,
  onClearAll,
  onRetry,
}: UploadReviewProps) {
  const t = useTranslations('AdminPage.photos.upload')
  const locale = useLocale() as SupportedLocale

  const doneCount = photos.filter((p) => p.status === 'done').length
  const active = photos.filter(
    (p) =>
      p.status === 'uploading' ||
      p.status === 'processing' ||
      (running && confirmableIds.has(p.localId))
  )
  const total = doneCount + active.length
  const progress =
    total === 0
      ? 0
      : (doneCount +
          active.reduce(
            (sum, p) =>
              sum + (p.status === 'processing' ? 1 : p.status === 'uploading' ? p.progress : 0),
            0
          )) /
        total

  const title = allDone
    ? t('allDone')
    : running
      ? t('uploadingTitle', { done: doneCount, total })
      : t('reviewTitle', { count: confirmableIds.size })

  const statusOf = (p: StagedPhoto) => {
    switch (p.status) {
      case 'done':
        return (
          <span className={`${style.statusText} ${style.statusDone}`}>
            <Icon name="check" size="xs" /> {t('done')}
          </span>
        )
      case 'uploading':
        return <span className={style.statusText}>{Math.round(p.progress * 100)}%</span>
      case 'processing':
        return <span className={style.statusText}>{t('processing')}</span>
      case 'reading':
        return <span className={style.statusText}>{t('reading')}</span>
      case 'error':
        return (
          <Button size="small" variant="secondary" onClick={() => onRetry(p.localId)}>
            {t('retry')}
          </Button>
        )
      default:
        if (confirmableIds.has(p.localId)) {
          return running ? (
            <span className={style.statusText}>{t('waiting')}</span>
          ) : (
            <button type="button" className={style.textAction} onClick={() => onEdit(p.localId)}>
              {t('edit')}
            </button>
          )
        }
        return (
          <button type="button" className={style.textAction} onClick={() => onEdit(p.localId)}>
            {t('fix')}
          </button>
        )
    }
  }

  const subOf = (p: StagedPhoto) => {
    if (p.status === 'invalid') return t('unreadable')
    if (p.status === 'error') return p.error
    if (p.status === 'ready' && !p.hasExifDate) return t('needsDate')
    if (slugErrors[p.localId]) return slugErrors[p.localId]
    const langs = [
      (p.captionZh.trim() || p.locationNameZh.trim()) && t('langZh'),
      (p.captionEn.trim() || p.locationNameEn.trim()) && t('langEn'),
    ].filter(Boolean)
    const date = p.takenAtLocal
      ? formatTakenAt(
          normalizeTakenAtLocal(p.takenAtLocal, p.takenAtPrecision),
          p.takenAtPrecision,
          locale
        )
      : ''
    return [langs.join(' '), date].filter(Boolean).join(' · ')
  }

  const isProblem = (p: StagedPhoto) =>
    p.status === 'invalid' ||
    p.status === 'error' ||
    (p.status === 'ready' && !confirmableIds.has(p.localId))

  return (
    <div className={style.review}>
      <div className={style.reviewHead}>
        <h2 className={style.reviewTitle}>{title}</h2>
        <p className={style.reviewHint}>{t('reviewHint')}</p>
        {(running || doneCount > 0) && (
          <div className={style.progressTrack}>
            <div className={style.progressFill} style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
      </div>

      <ul className={style.reviewList}>
        {photos.map((p) => (
          <li key={p.localId} className={style.reviewRow}>
            <div className={style.reviewThumb}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.previewUrl} alt="" />
            </div>
            <div className={style.reviewBody}>
              <p className={style.reviewName}>
                {p.captionZh.trim() || p.captionEn.trim() || p.file.name}
              </p>
              <p className={`${style.reviewSub} ${isProblem(p) ? style.reviewSubWarn : ''}`}>
                {subOf(p)}
              </p>
              {p.status === 'uploading' && (
                <div className={style.progressTrack}>
                  <div
                    className={style.progressFill}
                    style={{ width: `${Math.round(p.progress * 100)}%` }}
                  />
                </div>
              )}
            </div>
            <div className={style.reviewStatus}>{statusOf(p)}</div>
          </li>
        ))}
      </ul>

      <div className={style.actionBar}>
        {allDone ? (
          <>
            <Button variant="ghost" onClick={onClearAll}>
              {t('uploadMore')}
            </Button>
            <Link href="/photos" className={style.doneLink}>
              {t('viewList')}
            </Link>
          </>
        ) : running ? (
          <Button variant="secondary" onClick={onCancel}>
            {t('cancel')}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClearAll}>
              {t('clearAll')}
            </Button>
            <span className={style.actionSpacer} />
            <Button variant="secondary" onClick={onBack}>
              {t('backToEdit')}
            </Button>
            <Button onClick={onConfirm} disabled={confirmableIds.size === 0}>
              {t('uploadCount', { count: confirmableIds.size })}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
