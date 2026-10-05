'use client'

import { motion, useTransform, type MotionValue } from 'motion/react'
import { useTranslations } from 'next-intl'
import Icon from '@/app/components/Icon/Icon'
import styles from './GalleryWall.module.scss'

interface FocusOverlayProps {
  scale: MotionValue<number>
  fitScale: number
  /** 目前照片在牆上的順序（0 起算） */
  index: number
  total: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  escHint: boolean
}

/**
 * 聚焦時的最小固定控制（螢幕座標，不隨牆縮放）：關閉鍵、底部的上一張／下一張導覽列。
 * 照片資訊改由照片自身的資訊卡呈現（與照片同平面），這裡不再疊資訊層。
 * 導覽列底下的空間在 fit 時已讓出來，不會擋到照片，所以常駐；
 * 關閉鍵疊在照片上，放大超過 fit 時淡出，讓細節不被遮。
 */
export default function FocusOverlay({
  scale,
  fitScale,
  index,
  total,
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

      <div className={styles.focusNav}>
        <button
          type="button"
          className={styles.focusNavButton}
          onClick={onPrev}
          disabled={index <= 0}
          aria-label={t('controls.prevPhoto')}
        >
          <Icon name="arrow-left" />
        </button>
        <span className={styles.focusNavCount}>
          {index + 1} / {total}
        </span>
        <button
          type="button"
          className={styles.focusNavButton}
          onClick={onNext}
          disabled={index >= total - 1}
          aria-label={t('controls.nextPhoto')}
        >
          <Icon name="arrow-right" />
        </button>
      </div>

      {escHint && (
        <div className={styles.escHint} aria-hidden="true">
          Esc · {t('backToWall')}
        </div>
      )}
    </div>
  )
}
