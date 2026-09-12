'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Link, usePathname } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import Icon, { type IconName } from '@/app/components/Icon/Icon'
import { ThemeControl, LocaleControl } from './NavPrefs'
import style from './MenuDrawer.module.scss'

const NAV_ITEMS: { href: string; key: 'blog' | 'notes' | 'gallery' | 'about'; icon: IconName }[] = [
  { href: '/blog', key: 'blog', icon: 'newspaper' },
  { href: '/notes', key: 'notes', icon: 'comment' },
  { href: '/photography', key: 'gallery', icon: 'camera' },
  { href: '/about', key: 'about', icon: 'user' },
]

type Props = {
  isOpen: boolean
  onClose: () => void
}

/**
 * 手機用的完整導覽/設定窗口。沒有面板、沒有邊框：一片右濃左淡的漸層
 * 從右側漸入，選項再依序從右邊漸出——跟桌機導軌「圖示→文字」的展開
 * 是同一種語彙，只是換成水平方向。
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

  const ease = [0.23, 1, 0.32, 1] as const
  // 漸層先進場，選項才一個接一個跟上；關閉時反過來收，不拖泥帶水。
  const listVariants = {
    open: { transition: { staggerChildren: reduce ? 0 : 0.05, delayChildren: reduce ? 0 : 0.12 } },
    closed: { transition: { staggerChildren: 0 } },
  }
  const itemVariants = {
    open: { opacity: 1, x: 0, transition: { duration: reduce ? 0.01 : 0.34, ease } },
    closed: { opacity: 0, x: reduce ? 0 : 28, transition: { duration: reduce ? 0.01 : 0.16 } },
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 模糊層刻意「不做任何動畫」：backdrop-filter 一旦碰到 opacity
              動畫（motion 會讓該元素變成 backdrop root），就取樣不到後面的
              頁面，模糊會整個失效。所以這層用純 CSS、只負責模糊與接點擊。 */}
          <div className={style.backdrop} onClick={onClose} />
          <motion.div
            className={style.panel}
            role="dialog"
            aria-modal="true"
            aria-label={t('menu')}
            variants={listVariants}
            initial="closed"
            animate="open"
            exit="closed"
            onClick={onClose} // 點面板空白處＝點外面，一樣關閉
          >
            {/* 漸層本體：模糊在底下那層，這裡只負責顏色與滑入 */}
            <motion.div
              className={style.wash}
              initial={{ opacity: 0, x: '30%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '30%' }}
              transition={{ duration: reduce ? 0.01 : 0.36, ease }}
            />

            <motion.div className={style.panelHeader} variants={itemVariants}>
              <button
                ref={closeButtonRef}
                type="button"
                className={style.closeButton}
                onClick={onClose}
                aria-label={t('closeMenu')}
              >
                <Icon name="xmark" />
              </button>
            </motion.div>

            <nav className={style.nav} aria-label={t('menu')}>
              {NAV_ITEMS.map(({ href, key, icon }) => {
                const active =
                  currentPath === href || currentPath.startsWith(`${href}/`)
                return (
                  <motion.div key={href} variants={itemVariants}>
                    <Link
                      href={href}
                      className={`${style.navLink} ${active ? style.active : ''}`}
                      onClick={onClose}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span>{t(key)}</span>
                      <Icon name={icon} className={style.navIcon} fixedWidth />
                    </Link>
                  </motion.div>
                )
              })}
            </nav>

            {/* 主題／語言跟桌機導軌是同一組元件（見 NavPrefs），只是這裡
                靠右排、字大一點。它們是「調整」不是「前往」，點了不該把
                抽屜收掉。 */}
            <motion.div
              className={style.controls}
              variants={itemVariants}
              onClick={(e) => e.stopPropagation()}
            >
              <span className={style.controlsLabel}>{t('preferences')}</span>
              <ThemeControl />
              <LocaleControl />
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
