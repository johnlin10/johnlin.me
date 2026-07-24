'use client'

import style from './LanguageSwitch.module.scss'
import { useLocale } from 'next-intl'
// 修正：使用 next-intl 的 navigation hooks
import { usePathname, useRouter } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { useTransition } from 'react'
import { getLanguageDisplayName, languages } from '@/i18n/langueges'
import Icon from '../Icon/Icon'

/**
 * 語言切換元件
 */
export default function LanguageSwitch() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const currentShortName = languages[locale]?.shortName || locale.toUpperCase()

  const handleLanguageChange = (newLocale: string) => {
    // 修正：使用 next-intl 的 router.push，會自動處理 locale 路由
    startTransition(() => {
      router.push(pathname, { locale: newLocale })
    })
  }

  return (
    <div className={style.language_switch}>
      <div className={style.language_switch_item}>
        <div className={style.language_display}>
          {/* 手機：只顯示地球圖示（節省空間、維持好按的目標） */}
          <Icon name="globe" size="sm" className={style.language_globe} />
          {/* 桌機：顯示語言縮寫 + 下拉箭頭 */}
          <span className={style.language_current}>{currentShortName}</span>
          <Icon
            name="chevron-down"
            size="sm"
            className={style.language_chevron}
          />
        </div>

        <select
          name="language"
          id="language"
          value={locale}
          onChange={(e) => handleLanguageChange(e.target.value)}
          disabled={isPending}
          className={style.language_select}
        >
          {routing.locales.map((locale) => (
            <option key={locale} value={locale}>
              {getLanguageDisplayName(locale)}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
