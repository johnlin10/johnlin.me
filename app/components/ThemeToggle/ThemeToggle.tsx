'use client'

import { useTheme } from '@/app/contexts/ThemeContext'
import styles from './ThemeToggle.module.scss'
import Icon from '../Icon/Icon'
import { useEffect, useState } from 'react'

/**
 * 主題切換元件
 * 支援亮色、暗色和系統主題三種模式
 */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const [mounted, setMounted] = useState(false)
  //* 等待客戶端 hydration 完成
  useEffect(() => {
    setMounted(true)
  }, [])

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
  if (!mounted) {
    return (
      <div className={styles.theme_toggle}>
        <div className={styles.theme_toggle_container}>
          <div className={styles.theme_toggle_icons}>
            <div className={styles.system}>
              <Icon name="circle-half-stroke" size="lg" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.theme_toggle} onClick={handleThemeToggle}>
      <div className={styles.theme_toggle_container}>
        <div className={styles.theme_toggle_icons}>
          <div
            className={`${styles.light} ${
              theme === 'light' ? styles.active : ''
            }`}
          >
            <Icon name="sun" size="lg" />
          </div>
          <div
            className={`${styles.system} ${
              theme === 'system' ? styles.active : ''
            }`}
          >
            <Icon name="circle-half-stroke" size="lg" />
          </div>
          <div
            className={`${styles.dark} ${
              theme === 'dark' ? styles.active : ''
            }`}
          >
            <Icon name="moon" size="lg" />
          </div>
        </div>
      </div>
    </div>
  )
}
