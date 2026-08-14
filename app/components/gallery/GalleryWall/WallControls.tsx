'use client'

import { useTranslations } from 'next-intl'
import styles from './GalleryWall.module.scss'

interface WallControlsProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onFitWall: () => void
}

/**
 * 常駐的縮放控制。任何輸入裝置（含輸入偵測誤判的滑鼠）都能靠 +/− 縮放，
 * 「看整面牆」把鏡頭動畫回 fitWall。
 */
export default function WallControls({
  onZoomIn,
  onZoomOut,
  onFitWall,
}: WallControlsProps) {
  const t = useTranslations('GalleryPage.controls')
  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.controlButton}
        onClick={onFitWall}
        aria-label={t('fitWall')}
      >
        <span aria-hidden="true">⤢</span>
      </button>
      <button
        type="button"
        className={styles.controlButton}
        onClick={onZoomOut}
        aria-label={t('zoomOut')}
      >
        <span aria-hidden="true">−</span>
      </button>
      <button
        type="button"
        className={styles.controlButton}
        onClick={onZoomIn}
        aria-label={t('zoomIn')}
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  )
}
