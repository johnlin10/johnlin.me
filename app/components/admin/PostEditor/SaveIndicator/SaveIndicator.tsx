'use client'

import { useLocale, useTranslations } from 'next-intl'
import Icon from '@/app/components/Icon/Icon'
import { usePostEditorState, usePostEditorActions } from '../usePostEditor'
import style from './SaveIndicator.module.scss'

/**
 * 自動儲存狀態指示器。手機上文字會收合，只留圖示/圓點。
 */
export default function SaveIndicator() {
  const t = useTranslations('AdminPage.postEditor.saveIndicator')
  const locale = useLocale()
  const { saveState, lastSavedAt } = usePostEditorState()
  const { retrySave } = usePostEditorActions()

  if (saveState === 'idle') return null

  if (saveState === 'dirty') {
    return (
      <span className={`${style.indicator} ${style.dirty}`}>
        <span className={style.dot} aria-hidden />
        <span className={style.label}>{t('unsaved')}</span>
      </span>
    )
  }

  if (saveState === 'saving') {
    return (
      <span className={`${style.indicator} ${style.saving}`}>
        <span className={style.pulseDot} aria-hidden />
        <span className={style.label}>{t('saving')}</span>
      </span>
    )
  }

  if (saveState === 'error') {
    return (
      <button
        type="button"
        className={`${style.indicator} ${style.error}`}
        onClick={retrySave}
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
      <span className={style.label}>{t('saved')}{time ? ` ${time}` : ''}</span>
    </span>
  )
}
