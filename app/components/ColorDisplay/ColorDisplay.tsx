'use client'

import { useEffect, useState } from 'react'
import {
  getColorValue,
  copyColorToClipboard,
  isValidColor,
} from '@/app/utils/colorUtils'
import styles from './ColorDisplay.module.scss'
import { useTranslations } from 'next-intl'

interface ColorDisplayProps {
  name: string
  colorVar: string
  className?: string
}

/**
 * 顏色顯示元件
 * 用於顯示 CSS 變數的實際顏色值
 */
const ColorDisplay: React.FC<ColorDisplayProps> = ({
  name,
  colorVar,
  className = '',
}) => {
  const [colorValue, setColorValue] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const t = useTranslations('LabPage.PalettePage.color_display')

  useEffect(() => {
    //* 元件掛載後讀取顏色值
    const loadColorValue = () => {
      try {
        const value = getColorValue(colorVar)
        setColorValue(value)
      } catch (error) {
        console.error('讀取顏色值失敗:', error)
        setColorValue('')
      } finally {
        setIsLoading(false)
      }
    }

    loadColorValue()
  }, [colorVar])

  /**
   * 處理顏色值複製
   */
  const handleCopyColor = async () => {
    if (isValidColor(colorValue)) {
      await copyColorToClipboard(colorValue, name)
    }
  }

  return (
    <div
      className={`${styles.color_display} ${className}`}
      style={{ backgroundColor: `var(${colorVar})` }}
      onClick={handleCopyColor}
      title={`${t('click-to-copy')} ${name} ${t('color_value')}`}
    >
      <span className={styles.color_name}>{name}</span>
      <span className={styles.color_value}>
        {isLoading ? t('loading') : colorValue || t('error')}
      </span>
    </div>
  )
}

export default ColorDisplay
