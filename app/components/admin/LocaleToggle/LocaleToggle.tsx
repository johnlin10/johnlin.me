'use client'

import { useTranslations } from 'next-intl'
import type { SupportedLocale } from '@/app/types/blog'
import style from './LocaleToggle.module.scss'

const LOCALES: { value: SupportedLocale; labelKey: 'zh' | 'en' }[] = [
  { value: 'zh-tw', labelKey: 'zh' },
  { value: 'en', labelKey: 'en' },
]

interface LocaleToggleProps {
  value: SupportedLocale
  onChange: (locale: SupportedLocale) => void
  /**
   * 哪些語系已經有內容。填了的語系右邊會出現一個小點，
   * 「還沒寫英文版」才看得出來 —— 判斷條件因實體而異（文章看標題＋內文，
   * 照片看說明），所以由呼叫端算好傳進來。
   */
  filled?: Partial<Record<SupportedLocale, boolean>>
}

/** 中／英內容切換。純呈現，當前語系由呼叫端持有。 */
export default function LocaleToggle({
  value,
  onChange,
  filled,
}: LocaleToggleProps) {
  const t = useTranslations('AdminPage.localeToggle')

  return (
    <div className={style.toggle} role="tablist" aria-label={t('ariaLabel')}>
      {LOCALES.map(({ value: locale, labelKey }) => {
        const active = value === locale
        return (
          <button
            key={locale}
            type="button"
            role="tab"
            aria-selected={active}
            className={`${style.tab} ${active ? style.active : ''}`}
            onClick={() => onChange(locale)}
          >
            {t(labelKey)}
            {filled?.[locale] && <span className={style.dot} aria-hidden />}
          </button>
        )
      })}
    </div>
  )
}
