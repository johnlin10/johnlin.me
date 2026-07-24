'use client'

import Image from 'next/image'
import { Link, usePathname } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { useScroll, useMotionValueEvent } from 'motion/react'
import { useRef, useState } from 'react'
import style from './Header.module.scss'

import LanguageSwitch from '@/app/components/LanguageSwitch/LanguageSwitch'
import ThemeToggle from '@/app/components/ThemeToggle/ThemeToggle'

const NAV_ITEMS = [
  { href: '/blog', key: 'blog' },
  { href: '/gallery', key: 'gallery' },
  { href: '/about', key: 'about' },
] as const

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
  const { scrollY } = useScroll()
  const lastY = useRef(0)

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

  return (
    <header className={style.dock} data-collapsed={collapsed}>
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

      <div className={`${style.island} ${style.navIsland}`}>
        <nav className={style.nav} aria-label="primary">
          {NAV_ITEMS.map(({ href, key }) => {
            const active =
              currentPath === href || currentPath.startsWith(`${href}/`)
            return (
              <Link
                key={href}
                href={href}
                className={`${style.link} ${active ? style.active : ''}`}
              >
                {t(key)}
              </Link>
            )
          })}
        </nav>

        <span className={style.divider} aria-hidden />

        <div className={style.actions}>
          <ThemeToggle />
          <LanguageSwitch />
        </div>
      </div>
    </header>
  )
}
