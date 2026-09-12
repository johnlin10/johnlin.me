'use client'

import Image from 'next/image'
import { Link, usePathname } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { useScroll, useMotionValueEvent } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import style from './Header.module.scss'

import Icon, { type IconName } from '@/app/components/Icon/Icon'
import MenuDrawer from './MenuDrawer'
import { useHeaderSubNavSlot } from './HeaderSubNavContext'
import { ThemeControl, LocaleControl } from './NavPrefs'

const NAV_ITEMS: {
  href: string
  key: 'blog' | 'notes' | 'gallery' | 'about'
  icon: IconName
}[] = [
  { href: '/blog', key: 'blog', icon: 'newspaper' },
  { href: '/notes', key: 'notes', icon: 'comment' },
  { href: '/photography', key: 'gallery', icon: 'camera' },
  { href: '/about', key: 'about', icon: 'user' },
]

// 捲動狀態的門檻與去抖：低於此高度一律顯示；小於此位移量忽略（避免抖動）。
const TOP_THRESHOLD = 64
const DELTA_THRESHOLD = 6

/**
 * 桌機＝左側直立導軌，平時極淡、只有圖示；滑鼠靠近（或鍵盤聚焦）整條才
 * 展開文字並浮出漸層，跟內容分層。導軌本體不吃指標事件，只有圖示／按鈕
 * 吃，所以蓋在內容上也不會擋住點擊。
 * 手機／平板＝頂部細列，左 Logo 右漢堡，向下捲整條滑出畫面。
 */
export default function Header() {
  const currentPath = usePathname()
  const t = useTranslations('Header')

  const [hidden, setHidden] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { scrollY } = useScroll()
  const lastY = useRef(0)
  const { setSlot } = useHeaderSubNavSlot()

  // 換頁後自動收起手機 Menu 抽屜，避免使用者切到下一頁時窗口還開著。
  useEffect(() => {
    setMenuOpen(false)
  }, [currentPath])

  useMotionValueEvent(scrollY, 'change', (y) => {
    if (y < TOP_THRESHOLD) {
      lastY.current = y
      setHidden(false)
      return
    }
    const delta = y - lastY.current
    if (Math.abs(delta) < DELTA_THRESHOLD) return
    lastY.current = y
    setHidden(delta > 0) // 往下＝收起，往上＝滑回
  })

  // 後台有自己的側邊欄外殼，不套用公開站的導軌。
  if (currentPath.startsWith('/admin')) return null

  return (
    <header className={style.shell} data-hidden={hidden}>
      <div className={style.rail}>
        {/* 漸層背景：桌機展開時才浮現，手機常駐（讓頂列文字有底） */}
        <div className={style.railBg} />

        <Link href="/" className={style.brand} aria-label={t('home')}>
          <Image
            src="/assets/icons/web-icons/johnlin-logo-192.png"
            alt="John Lin"
            width={32}
            height={32}
            className={style.logo}
            priority
          />
        </Link>

        <nav className={style.nav} aria-label="primary">
          {NAV_ITEMS.map(({ href, key, icon }) => {
            const active =
              currentPath === href || currentPath.startsWith(`${href}/`)
            return (
              <Link
                key={href}
                href={href}
                data-nav-item
                className={`${style.item} ${active ? style.active : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon name={icon} className={style.itemIcon} fixedWidth />
                <span data-nav-label>{t(key)}</span>
              </Link>
            )
          })}
        </nav>

        {/* 桌機不另開抽屜：主題與語言就是導軌最下面兩列，跟手機選單
            共用同一組元件（見 NavPrefs），只是版位不同。 */}
        <div className={style.settings}>
          <ThemeControl />
          <LocaleControl />
        </div>

        {/* 手機／平板專用：導覽與設定都收進抽屜裡。 */}
        <button
          type="button"
          className={style.menuTrigger}
          onClick={() => setMenuOpen(true)}
          aria-label={t('menu')}
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
        >
          <Icon name="bars" />
        </button>
      </div>

      {/* 頁面自帶的次導覽（例如 About 的手機章節列）portal 進來的掛載點；
          沒有內容時 CSS :empty 讓它完全不佔版面、不繪製背景。 */}
      <div className={style.subNavHost} ref={setSlot} />

      <MenuDrawer isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
    </header>
  )
}
