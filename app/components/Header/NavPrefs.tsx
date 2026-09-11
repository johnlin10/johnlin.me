'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { languages } from '@/i18n/langueges'
import Icon from '@/app/components/Icon/Icon'
import { NEXT_THEME, THEME_ICON } from '@/app/components/ThemeToggle/ThemeToggle'
import { useTheme } from '@/app/contexts/ThemeContext'
import style from './NavPrefs.module.scss'

/**
 * 公開站的偏好設定控制：桌機導軌與手機選單共用同一組，不做兩套。
 * 這裡只管「長什麼樣」（圖示＋文字、無邊框無底色），版位與文字何時
 * 出現交給使用它的 Header / MenuDrawer——兩邊都靠 data-nav-item /
 * data-nav-label 這兩個屬性掛規則，不必跨 CSS module 借 class 名。
 */
export function ThemeControl() {
  const { theme, setTheme } = useTheme()
  const t = useTranslations('ThemeToggle')

  // next-themes 在客戶端第一次 render 就會讀到 localStorage 的值，
  // 跟伺服器算出來的對不上，所以掛載完成前一律當作 system。
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  const current = (mounted ? theme : 'system') ?? 'system'

  return (
    <button
      type="button"
      data-nav-item
      className={style.control}
      onClick={() => setTheme(NEXT_THEME[current] ?? 'light')}
      aria-label={t(`${current}_action_label` as 'light_action_label')}
    >
      <Icon
        name={THEME_ICON[current] ?? 'circle-half-stroke'}
        className={style.icon}
        fixedWidth
      />
      <span data-nav-label className={style.label}>
        {t(current as 'system')}
      </span>
    </button>
  )
}

/**
 * 語言：原生 <select>，不做「按一下換一種」。少按一下的代價是使用者按
 * 之前不知道會變成什麼——尤其第一次來的人。下拉選單是大家都認得的
 * 「這裡有得選」訊號，展開前看得到現在是哪個語言，展開後看得到有哪些。
 * 用原生元素而不是自訂 Select：行動裝置直接叫出系統選單，鍵盤、螢幕
 * 閱讀器、色彩模式（color-scheme）全都不必自己實作。
 */
export function LocaleControl() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('Header')

  const switchTo = (next: string) => {
    if (next === locale) return
    // usePathname() 不含 query string（例如 About 頁的 ?chapter=），
    // 補回目前網址的 search，切語言才不會把使用者停留的章節重置掉。
    const search = typeof window !== 'undefined' ? window.location.search : ''
    router.push(`${pathname}${search}`, { locale: next })
  }

  return (
    <div data-nav-item className={style.control}>
      <Icon name="globe" className={style.icon} fixedWidth />
      <span data-nav-label className={style.label}>
        <span className={style.selectWrap}>
          <select
            className={style.select}
            value={locale}
            onChange={(e) => switchTo(e.target.value)}
            aria-label={t('language')}
          >
            {routing.locales.map((code) => (
              <option key={code} value={code}>
                {languages[code]?.nativeName ?? code}
              </option>
            ))}
          </select>
          {/* 自己畫箭頭（原生那顆太「系統」了）；它不吃指標事件，
              點在箭頭上等同點在 select 上。 */}
          <Icon name="chevron-down" className={style.caret} />
        </span>
      </span>
    </div>
  )
}
