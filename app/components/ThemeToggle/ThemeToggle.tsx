'use client'

import { useTheme } from '@/app/contexts/ThemeContext'
import { useEffect, useState } from 'react'
import styles from './ThemeToggle.module.scss'
import { useTranslations } from 'next-intl'
import Icon from '../Icon/Icon'

/**
 * 主題切換元件
 * 支援亮色、暗色和系統主題三種模式
 */
export default function ThemeToggle() {
  const t = useTranslations('ThemeToggle')
  const { theme, setTheme, systemTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  //* 防止 hydration 錯誤
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  const currentTheme = theme === 'system' ? 'system' : theme

  const handleThemeToggle = () => {
    let nextTheme: string
    if (theme === 'light') {
      nextTheme = 'system'
    } else if (theme === 'system') {
      nextTheme = 'dark'
    } else if (theme === 'dark') {
      nextTheme = 'light'
    } else {
      nextTheme = 'light'
    }

    setTheme(nextTheme)
  }

  return (
    <div className={styles.theme_toggle} onClick={handleThemeToggle}>
      <div className={styles.theme_toggle_container}>
        <div className={`${styles.current_theme} ${currentTheme}`}></div>
        <div className={styles.theme_toggle_icons}>
          <div
            className={`${styles.light_icon} ${
              theme === 'light' ? styles.active : ''
            }`}
          >
            <Icon name="sun" size="lg" />
          </div>
          <div
            className={`${styles.system_icon} ${
              theme === 'system' ? styles.active : ''
            }`}
          >
            <Icon name="circle-half-stroke" size="lg" />
          </div>
          <div
            className={`${styles.dark_icon} ${
              theme === 'dark' ? styles.active : ''
            }`}
          >
            <Icon name="moon" size="lg" />
          </div>
        </div>
      </div>

      {/* <button
        onClick={() => setTheme('light')}
        className={`${styles.theme_button} ${
          theme === 'light' ? styles.active : ''
        }`}
        aria-label={t('light_action_label')}
      >
        {t('light')}
      </button>

      <button
        onClick={() => setTheme('dark')}
        className={`${styles.theme_button} ${
          theme === 'dark' ? styles.active : ''
        }`}
        aria-label={t('dark_action_label')}
      >
        {t('dark')}
      </button>

      <button
        onClick={() => setTheme('system')}
        className={`${styles.theme_button} ${
          theme === 'system' ? styles.active : ''
        }`}
        aria-label={t('system_action_label')}
      >
        {t('system')}
      </button> */}

      {/* <div className={styles.current_theme}>
        {t('current_theme')} {currentTheme === 'dark' ? t('dark') : t('light')}
        {theme === 'system' && ` (${t('system')})`}
      </div> */}
    </div>
  )
}
