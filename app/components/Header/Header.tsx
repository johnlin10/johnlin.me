'use client'

import { Link, usePathname } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import style from './Header.module.scss'

import LanguageSwitch from '@/app/components/LanguageSwitch/LanguageSwitch'
import ThemeToggle from '@/app/components/ThemeToggle/ThemeToggle'

const NAV_ITEMS = [
  { href: '/blog', key: 'blog' },
  { href: '/gallery', key: 'gallery' },
  { href: '/about', key: 'about' },
] as const

export default function Header() {
  const currentPath = usePathname()
  const t = useTranslations('Header')

  return (
    <header className={style.header}>
      <div className={style.inner}>
        <Link href="/" className={style.brand} aria-label={t('home')}>
          林昌龍
        </Link>

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

        <div className={style.actions}>
          <ThemeToggle />
          <LanguageSwitch />
        </div>
      </div>
    </header>
  )
}
