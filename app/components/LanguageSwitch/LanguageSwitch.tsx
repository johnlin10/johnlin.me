'use client'

import { useTransition } from 'react'
import { useLocale } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { getLanguageDisplayName, languages } from '@/i18n/langueges'
import DropdownSelect from '@/app/components/admin/Selector/DropdownSelect'
import style from './LanguageSwitch.module.scss'

/**
 * 語言切換元件：觸發按鈕顯示縮寫（TW/EN），選項清單顯示完整語言名稱。
 */
export default function LanguageSwitch() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const currentShortName = languages[locale]?.shortName || locale.toUpperCase()

  const handleLanguageChange = (newLocale: string) => {
    if (!newLocale || newLocale === locale) return
    // usePathname() 不含 query string（例如 About 頁的 ?chapter=），
    // 這裡補回目前網址的 search，切語言才不會把使用者停留的章節重置掉。
    const search = typeof window !== 'undefined' ? window.location.search : ''
    startTransition(() => {
      router.push(`${pathname}${search}`, { locale: newLocale })
    })
  }

  return (
    <div className={style.language_switch}>
      <DropdownSelect
        value={locale}
        onChange={handleLanguageChange}
        options={routing.locales.map((code) => ({
          value: code,
          label: getLanguageDisplayName(code),
        }))}
        placeholder={currentShortName}
        triggerLabel={currentShortName}
        clearable={false}
        icon="globe"
        disabled={isPending}
      />
    </div>
  )
}
