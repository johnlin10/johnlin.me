'use client'

import SharedLocaleToggle from '@/app/components/admin/LocaleToggle/LocaleToggle'
import { hasText } from '../postDraft'
import { usePostEditorState, usePostEditorActions } from '../usePostEditor'

/**
 * 文章編輯器的語言切換。寫作頁與文章資訊頁共用同一個 currentLocale（來自 Provider），
 * 切到 English 之後兩個步驟都停留在 English。
 */
export default function LocaleToggle() {
  const { draft, currentLocale } = usePostEditorState()
  const { setCurrentLocale } = usePostEditorActions()

  const isFilled = (locale: 'zh-tw' | 'en') => {
    const content = draft.locales[locale]
    return Boolean(content.title.trim() || hasText(content.content))
  }

  return (
    <SharedLocaleToggle
      value={currentLocale}
      onChange={setCurrentLocale}
      filled={{ 'zh-tw': isFilled('zh-tw'), en: isFilled('en') }}
    />
  )
}
