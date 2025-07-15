'use client'

// 修正：使用 next-intl 的 Link 組件
import { Link } from '@/i18n/navigation'
import style from './Header.module.scss'

import Icon from '@/app/components/Icon/Icon'
import LanguageSwitch from '@/app/components/LanguageSwitch/LanguageSwitch'
import ThemeToggle from '@/app/components/ThemeToggle/ThemeToggle'
import { usePathname } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

export default function Header() {
  const currentPath = usePathname()
  const t = useTranslations('Header')

  return (
    <header className={style.header}>
      <div className={style.header_container}>
        <div className={style.header_nav}>
          <Link
            href="/"
            className={`${style.header_nav_item} ${
              currentPath === '/' ? style.active : ''
            }`}
          >
            <Icon name="home" className={style.header_nav_item_icon} />
            <span className={style.header_nav_item_text}>{t('home')}</span>
          </Link>
          <Link
            href="/blog"
            className={`${style.header_nav_item} ${
              currentPath === '/blog' ? style.active : ''
            }`}
          >
            <Icon name="newspaper" className={style.header_nav_item_icon} />
            <span className={style.header_nav_item_text}>{t('blog')}</span>
          </Link>
          <Link
            href="/about"
            className={`${style.header_nav_item} ${
              currentPath === '/about' ? style.active : ''
            }`}
          >
            <Icon name="user" className={style.header_nav_item_icon} />
            <span className={style.header_nav_item_text}>{t('about')}</span>
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
