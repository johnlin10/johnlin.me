'use client'

import { useLocale, useTranslations } from 'next-intl'
import type { SaveState } from '@/app/lib/hooks/useAutosave'
import Icon from '@/app/components/Icon/Icon'
import style from './SaveIndicator.module.scss'

interface SaveIndicatorProps {
  state: SaveState
  lastSavedAt: Date | null
  onRetry: () => void
}

/**
 * 自動儲存狀態指示器。純呈現，狀態由呼叫端的 useAutosave 提供 ——
 * 文章編輯器與照片檢閱欄共用同一組視覺語彙。
 * 手機上文字會收合，只留圖示／圓點。
 */
export default function SaveIndicator({
  state,
  lastSavedAt,
  onRetry,
}: SaveIndicatorProps) {
  const t = useTranslations('AdminPage.saveIndicator')
  const locale = useLocale()

  if (state === 'idle') return null

  if (state === 'dirty') {
    return (
      <span className={`${style.indicator} ${style.dirty}`}>
        <span className={style.dot} aria-hidden />
        <span className={style.label}>{t('unsaved')}</span>
      </span>
    )
  }

  if (state === 'saving') {
    return (
      <span className={`${style.indicator} ${style.saving}`}>
        <span className={style.pulseDot} aria-hidden />
        <span className={style.label}>{t('saving')}</span>
      </span>
    )
  }

  if (state === 'error') {
    return (
      <button
        type="button"
        className={`${style.indicator} ${style.error}`}
        onClick={onRetry}
      >
        <Icon name="triangle-exclamation" size="sm" />
        <span className={style.label}>{t('errorRetry')}</span>
      </button>
    )
  }

  const time = lastSavedAt
    ? lastSavedAt.toLocaleTimeString(locale === 'zh-tw' ? 'zh-TW' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  return (
    <span className={`${style.indicator} ${style.saved}`}>
      <Icon className={style.icon} name="check" size="sm" />
      <span className={style.label}>
        {t('saved')}
        {time ? ` ${time}` : ''}
      </span>
    </span>
  )
}
