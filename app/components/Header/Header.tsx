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

const NAV_ITEMS: {
  href: string
  key: 'blog' | 'notes' | 'gallery' | 'about'
  icon: IconName
}[] = [
  { href: '/blog', key: 'blog', icon: 'newspaper' },
  { href: '/notes', key: 'notes', icon: 'comment' },
  { href: '/gallery', key: 'gallery', icon: 'camera' },
  { href: '/about', key: 'about', icon: 'user' },
]

// 捲動狀態的門檻與去抖：低於此高度一律展開；小於此位移量忽略（避免抖動）。
const TOP_THRESHOLD = 64
const DELTA_THRESHOLD = 6

/**
 * 懸浮式分離頁首。左島＝首頁品牌，右島＝頁面連結＋基本設定。
 * 向下捲動：兩島縮小＋半透明，降低瀏覽干擾；向上捲動或回到頂端：復原。
 * 滑鼠懸停 / 鍵盤聚焦任一島：整組喚醒復原（純 CSS `:has` / `:focus-within`）。
 */
export default function Header() {
  const currentPath = usePathname()
  const t = useTranslations('Header')

  const [collapsed, setCollapsed] = useState(false)
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
      setCollapsed(false)
      return
    }
    const delta = y - lastY.current
    if (Math.abs(delta) < DELTA_THRESHOLD) return
    lastY.current = y
    setCollapsed(delta > 0) // 往下＝收合，往上＝展開
  })

  // 後台有自己的側邊欄外殼，不套用公開站的懸浮頁首。
  if (currentPath.startsWith('/admin')) return null

  return (
    <header className={style.shell} data-collapsed={collapsed}>
      {/* 漸層背景 */}
      <div className={style.gradientBackground}></div>
      <div className={style.dock}>
        <div className={`${style.island} ${style.brandIsland}`}>
          <Link href="/" className={style.brand} aria-label={t('home')}>
            <Image
              src="/johnlin-logo-128-nb.png"
              alt="John Lin"
              width={32}
              height={32}
              className={style.logo}
              priority
            />
          </Link>
        </div>

        <div className={style.rightGroup}>
          <div className={`${style.island} ${style.navIsland}`}>
            <nav className={style.nav} aria-label="primary">
              {NAV_ITEMS.map(({ href, key, icon }) => {
                const active =
                  currentPath === href || currentPath.startsWith(`${href}/`)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`${style.link} ${active ? style.active : ''}`}
                  >
                    <Icon name={icon} className={style.linkIcon} />
                    <span className={style.linkLabel}>{t(key)}</span>
                  </Link>
                )
              })}
            </nav>

            {/* 跟頁面導覽同一排、同一座島；不分裝置，主題/語言等控制選項一律收在這裡。 */}
            <button
              type="button"
              className={style.menuTrigger}
              onClick={() => setMenuOpen(true)}
              aria-label={t('menu')}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
            >
              <Icon name="bars" className={style.linkIcon} />
            </button>
          </div>
        </div>
      </div>

      {/* 頁面自帶的次導覽（例如 About 的手機章節列）portal 進來的掛載點；
          沒有內容時 CSS :empty 讓它完全不佔版面、不繪製背景。 */}
      <div className={style.subNavHost} ref={setSlot} />

      <MenuDrawer isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
    </header>
  )
}
