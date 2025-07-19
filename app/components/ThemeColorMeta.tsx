'use client'

import { useTheme } from '../contexts/ThemeContext'
import { useEffect, useState } from 'react'

export default function ThemeColorMeta() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    // 定義不同主題對應的顏色（備用選項）
    const fallbackThemeColors = {
      light: '#ffffff', // 淺色主題的背景色
      dark: '#131313', // 深色主題的背景色 (gray-900)
    } as const

    // 嘗試從 CSS 變數獲取顏色，否則使用備用顏色
    const currentColor =
      fallbackThemeColors[resolvedTheme as keyof typeof fallbackThemeColors] ||
      fallbackThemeColors.light

    // 更新或創建 theme-color meta 標籤
    const updateThemeColor = (color: string) => {
      let metaThemeColor = document.querySelector(
        'meta[name="theme-color"]'
      ) as HTMLMetaElement

      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', color)
      } else {
        metaThemeColor = document.createElement('meta')
        metaThemeColor.setAttribute('name', 'theme-color')
        metaThemeColor.setAttribute('content', color)
        document.head.appendChild(metaThemeColor)
      }
    }

    // 設定主題顏色
    updateThemeColor(currentColor)

    // 同時更新 manifest.json 中的 theme_color
    const manifestLink = document.querySelector(
      'link[rel="manifest"]'
    ) as HTMLLinkElement
    if (manifestLink) {
    }
  }, [resolvedTheme, mounted])

  return null
}
