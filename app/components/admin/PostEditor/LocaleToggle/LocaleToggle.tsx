'use client'

import { useTranslations } from 'next-intl'
import type { SupportedLocale } from '@/app/types/blog'
import { hasText } from '../postDraft'
import { usePostEditorState, usePostEditorActions } from '../usePostEditor'
import style from './LocaleToggle.module.scss'

const LOCALES: { value: SupportedLocale; labelKey: 'zh' | 'en' }[] = [
  { value: 'zh-tw', labelKey: 'zh' },
  { value: 'en', labelKey: 'en' },
]

/**
 * 中／英內容切換。寫作頁與文章資訊頁共用同一個 currentLocale（來自 Provider），
 * 切到 English 之後兩個步驟都停留在 English。
 */
export default function LocaleToggle() {
  const t = useTranslations('AdminPage.postEditor.localeToggle')
  const { draft, currentLocale } = usePostEditorState()
  const { setCurrentLocale } = usePostEditorActions()

  return (
    <div className={style.toggle} role="tablist" aria-label={t('ariaLabel')}>
      {LOCALES.map(({ value, labelKey }) => {
        const content = draft.locales[value]
        const filled = Boolean(content.title.trim() || hasText(content.content))
        const active = currentLocale === value
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`${style.tab} ${active ? style.active : ''}`}
            onClick={() => setCurrentLocale(value)}
          >
            {t(labelKey)}
            {filled && <span className={style.dot} aria-hidden />}
          </button>
        )
      })}
    </div>
  )
}
