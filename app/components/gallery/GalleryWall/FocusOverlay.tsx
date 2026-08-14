'use client'

import { motion, useTransform, type MotionValue } from 'motion/react'
import { useTranslations } from 'next-intl'
import Icon from '@/app/components/Icon/Icon'
import styles from './GalleryWall.module.scss'

interface FocusOverlayProps {
  scale: MotionValue<number>
  fitScale: number
  canPrev: boolean
  canNext: boolean
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  escHint: boolean
}

/**
 * 聚焦時的最小固定控制（螢幕座標，不隨牆縮放）：關閉鍵、上一張／下一張。
 * 照片資訊改由照片自身的資訊卡呈現（與照片同平面），這裡不再疊資訊層。
 * 放大超過 fit 時控制淡出，讓細節不被遮。
 */
export default function FocusOverlay({
  scale,
  fitScale,
  canPrev,
  canNext,
  onClose,
  onPrev,
  onNext,
  escHint,
}: FocusOverlayProps) {
  const t = useTranslations('GalleryPage')
  const uiOpacity = useTransform(
    scale,
    [fitScale, fitScale * 1.35],
    [1, 0]
  )

  return (
    <div className={styles.focusUi}>
      <motion.button
        type="button"
        className={styles.focusClose}
        style={{ opacity: uiOpacity }}
        onClick={onClose}
        aria-label={t('backToWall')}
      >
        <Icon name="xmark" />
      </motion.button>

      {canPrev && (
        <motion.button
          type="button"
          className={`${styles.focusArrow} ${styles.focusArrowLeft}`}
          style={{ opacity: uiOpacity }}
          onClick={onPrev}
          aria-label={t('controls.prevPhoto')}
        >
          <Icon name="arrow-left" />
        </motion.button>
      )}
      {canNext && (
        <motion.button
          type="button"
          className={`${styles.focusArrow} ${styles.focusArrowRight}`}
          style={{ opacity: uiOpacity }}
          onClick={onNext}
          aria-label={t('controls.nextPhoto')}
        >
          <Icon name="arrow-right" />
        </motion.button>
      )}

      {escHint && (
        <div className={styles.escHint} aria-hidden="true">
          Esc · {t('backToWall')}
        </div>
      )}
    </div>
  )
}
