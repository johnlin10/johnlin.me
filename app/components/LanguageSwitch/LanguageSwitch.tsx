'use client'

import style from './LanguageSwitch.module.scss'
import { useLocale } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
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
    let parsedPathname = pathname
    if (pathname.startsWith(`/${locale}`)) {
      parsedPathname = pathname.replace(`/${locale}`, `/${newLocale}`)
    }

    startTransition(() => {
      router.push(parsedPathname)
    })
  }

  return (
    <div className={style.language_switch}>
      <div className={style.language_switch_item}>
        <div className={style.language_display}>
          <span className={style.language_current}>{currentShortName}</span>
          <Icon name="chevron-down" size="sm" />
        </div>

        <select
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
