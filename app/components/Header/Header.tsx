'use client'

import Link from 'next/link'
import style from './Header.module.scss'

import Icon from '@/app/components/Icon/Icon'
import LanguageSwitch from '@/app/components/LanguageSwitch/LanguageSwitch'
import ThemeToggle from '@/app/components/ThemeToggle/ThemeToggle'
import { usePathname } from '@/i18n/navigation'

export default function Header() {
  const currentPath = usePathname()
  return (
    <header className={style.header}>
      <div className={style.header_container}>
        <div className={style.header_nav}>
          {/* <div className={style.nav_focus_indicator}></div> */}
          <Link
            href="/"
            className={`${style.header_nav_item} ${
              currentPath === '/' ? style.active : ''
            }`}
          >
            <Icon name="home" className={style.header_nav_item_icon} />
            <span className={style.header_nav_item_text}>Home</span>
          </Link>
          <Link
            href="/blog"
            className={`${style.header_nav_item} ${
              currentPath === '/blog' ? style.active : ''
            }`}
          >
            <Icon name="newspaper" className={style.header_nav_item_icon} />
            <span className={style.header_nav_item_text}>Blog</span>
          </Link>
          <Link
            href="/about"
            className={`${style.header_nav_item} ${
              currentPath === '/about' ? style.active : ''
            }`}
          >
            <Icon name="user" className={style.header_nav_item_icon} />
            <span className={style.header_nav_item_text}>About</span>
          </Link>
        </div>
        <div className={style.actions}>
          <ThemeToggle />
          <LanguageSwitch />
        </div>
      </div>
    </header>
  )
}
