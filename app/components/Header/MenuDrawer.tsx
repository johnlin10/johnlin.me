'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Link, usePathname } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import Icon, { type IconName } from '@/app/components/Icon/Icon'
import ThemeToggle from '@/app/components/ThemeToggle/ThemeToggle'
import LanguageSwitch from '@/app/components/LanguageSwitch/LanguageSwitch'
import style from './MenuDrawer.module.scss'

const NAV_ITEMS: { href: string; key: 'blog' | 'notes' | 'gallery' | 'about'; icon: IconName }[] = [
  { href: '/blog', key: 'blog', icon: 'newspaper' },
  { href: '/notes', key: 'notes', icon: 'comment' },
  { href: '/gallery', key: 'gallery', icon: 'camera' },
  { href: '/about', key: 'about', icon: 'user' },
]

type Props = {
  isOpen: boolean
  onClose: () => void
}

/**
 * 手機用的完整導覽/設定窗口：右側滑入，寬度隨內容，不佔滿全寬。
 * Header 在手機模式把導覽收成純圖示、把主題/語言收進這裡，避免跟頁面自己的
 * 次導覽（見 HeaderSubNav）在頂端狹小空間裡打架。
 */
export default function MenuDrawer({ isOpen, onClose }: Props) {
  const currentPath = usePathname()
  const t = useTranslations('Header')
  const reduce = useReducedMotion()
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className={style.backdrop}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.01 : 0.2 }}
          />
          <motion.div
            className={style.panel}
            role="dialog"
            aria-modal="true"
            aria-label={t('menu')}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{
              duration: reduce ? 0.01 : 0.32,
              ease: [0.23, 1, 0.32, 1],
            }}
          >
            <div className={style.panelHeader}>
              <span className={style.panelTitle}>{t('menu')}</span>
              <button
                ref={closeButtonRef}
                type="button"
                className={style.closeButton}
                onClick={onClose}
                aria-label={t('closeMenu')}
              >
                <Icon name="xmark" />
              </button>
            </div>

            <nav className={style.nav} aria-label={t('menu')}>
              {NAV_ITEMS.map(({ href, key, icon }) => {
                const active =
                  currentPath === href || currentPath.startsWith(`${href}/`)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`${style.navLink} ${active ? style.active : ''}`}
                    onClick={onClose}
                  >
                    <Icon name={icon} className={style.navIcon} />
                    <span>{t(key)}</span>
                  </Link>
                )
              })}
            </nav>

            <div className={style.divider} />

            <div className={style.controls}>
              <span className={style.controlsLabel}>{t('preferences')}</span>
              <div className={style.controlsRow}>
                <ThemeToggle />
                <LanguageSwitch />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
