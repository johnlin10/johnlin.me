'use client'

import style from './LanguageSwitch.module.scss'
import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { useTransition } from 'react'
import { getLanguageDisplayName } from '@/i18n/langueges'

/**
 * 語言切換元件
 */
export default function LanguageSwitch() {
  // const t = useTranslations('LanguageSwitch')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

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
        <select
          value={locale}
          onChange={(e) => handleLanguageChange(e.target.value)}
          disabled={isPending}
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
