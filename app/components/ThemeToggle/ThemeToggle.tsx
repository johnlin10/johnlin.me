'use client'

import { useTheme } from '@/app/contexts/ThemeContext'
import styles from './ThemeToggle.module.scss'
import Icon, { type IconName } from '../Icon/Icon'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

/**
 * 主題切換元件（極簡：單一圖示按鈕，點擊循環 亮 → 系統 → 暗）
 */
const NEXT_THEME: Record<string, string> = {
  light: 'system',
  system: 'dark',
  dark: 'light',
}

const THEME_ICON: Record<string, IconName> = {
  light: 'sun',
  system: 'circle-half-stroke',
  dark: 'moon',
}

const THEME_ORDER = ['light', 'system', 'dark'] as const

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const t = useTranslations('ThemeToggle')
  const reduce = useReducedMotion()

  const [mounted, setMounted] = useState(false)
  //* 等待客戶端 hydration 完成
  useEffect(() => {
    setMounted(true)
  }, [])

  const current = (mounted ? theme : 'system') ?? 'system'
  const iconName = THEME_ICON[current] ?? 'circle-half-stroke'
  const label = t(`${current}_action_label` as 'light_action_label')

  const handleThemeToggle = () => {
    setTheme(NEXT_THEME[current] ?? 'light')
  }

  return (
    <button
      type="button"
      className={styles.themeToggle}
      onClick={handleThemeToggle}
      aria-label={label}
      title={label}
    >
      {/* 圖示裝在固定 1em 見方的殼裡，動畫的進/出圖示都用 absolute 疊在殼內，
          寬度殼自己定，不會因為哪個圖示正在飛進飛出而讓按鈕跟著抖動。 */}
      <span className={styles.iconStack}>
        <AnimatePresence initial={false}>
          <motion.span
            key={iconName}
            className={styles.iconMotion}
            initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
            transition={{ duration: reduce ? 0.01 : 0.28, ease: [0.23, 1, 0.32, 1] }}
          >
            {/* fixedWidth：sun/moon/circle-half-stroke 這幾個圖示天生寬高比
                不同，鎖寬才能放心讓殼只靠 CSS 撐 1em，不用另外量測。 */}
            <Icon name={iconName} size="sm" fixedWidth />
          </motion.span>
        </AnimatePresence>
      </span>
      {/* 三種狀態文字疊在同一個 grid cell，寬度固定取最寬的那個，切換時
          按鈕才不會跟著文字長度變寬變窄、把旁邊的語言切換鈕擠得跑位。 */}
      <span className={styles.themeLabelStack}>
        {THEME_ORDER.map((themeKey) => (
          <motion.span
            key={themeKey}
            className={styles.themeLabel}
            animate={{ opacity: themeKey === current ? 1 : 0 }}
            transition={{ duration: reduce ? 0.01 : 0.22, ease: [0.23, 1, 0.32, 1] }}
            aria-hidden={themeKey !== current}
          >
            {t(themeKey)}
          </motion.span>
        ))}
      </span>
    </button>
  )
}
