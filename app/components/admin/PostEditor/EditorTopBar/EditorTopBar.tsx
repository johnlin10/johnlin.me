'use client'

import { useSelectedLayoutSegment } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Icon from '@/app/components/Icon/Icon'
import Button from '@/app/components/admin/Button/Button'
import { usePostEditorState, usePostEditorActions } from '../usePostEditor'
import SaveIndicator from '../SaveIndicator/SaveIndicator'
import style from './EditorTopBar.module.scss'

/**
 * 全螢幕編輯器的頂欄：返回／步驟指示／自動儲存狀態／主要動作。
 * 放在 [id]/layout.tsx，不隨 write ↔ settings 切換重新渲染。
 */
export default function EditorTopBar() {
  const t = useTranslations('AdminPage.postEditor.topBar')
  const segment = useSelectedLayoutSegment()
  const isSettings = segment === 'settings'
  const { draft } = usePostEditorState()
  const actions = usePostEditorActions()
  const isPublished = draft.status === 'published'

  return (
    <header className={style.topbar}>
      <div className={style.left}>
        {isSettings ? (
          <button
            type="button"
            className={style.backButton}
            onClick={() => void actions.goToWrite()}
          >
            <Icon name="arrow-left" size="sm" />
            <span className={style.backLabel}>{t('backToWrite')}</span>
          </button>
        ) : (
          <button
            type="button"
            className={style.backButton}
            onClick={() => void actions.exit()}
          >
            <Icon name="arrow-left" size="sm" />
            <span className={style.backLabel}>{t('backToList')}</span>
          </button>
        )}
      </div>

      <div className={style.center}>
        <button
          type="button"
          className={`${style.step} ${!isSettings ? style.active : ''}`}
          onClick={() => isSettings && void actions.goToWrite()}
        >
          {t('writeTab')}
        </button>
        <span className={style.stepSeparator} aria-hidden>
          ›
        </span>
        <button
          type="button"
          className={`${style.step} ${isSettings ? style.active : ''}`}
          onClick={() => !isSettings && void actions.goToSettings()}
        >
          {t('infoTab')}
        </button>
      </div>

      <div className={style.right}>
        <SaveIndicator />
        {!isSettings && (
          <Button size="small" onClick={() => void actions.goToSettings()}>
            {t('next')}
          </Button>
        )}
        {isSettings && !isPublished && (
          <>
            <Button
              variant="secondary"
              size="small"
              onClick={() => void actions.saveDraft()}
            >
              {t('saveDraft')}
            </Button>
            <Button size="small" onClick={() => void actions.publish()}>
              {t('publish')}
            </Button>
          </>
        )}
        {isSettings && isPublished && (
          <Button size="small" onClick={() => void actions.update()}>
            {t('update')}
          </Button>
        )}
      </div>
    </header>
  )
}
