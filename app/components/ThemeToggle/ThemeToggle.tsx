'use client'

import { useTheme } from '@/app/contexts/ThemeContext'
import styles from './ThemeToggle.module.scss'
import Icon, { type IconName } from '../Icon/Icon'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

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

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const t = useTranslations('ThemeToggle')

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
      <Icon name={iconName} size="sm" />
    </button>
  )
}
