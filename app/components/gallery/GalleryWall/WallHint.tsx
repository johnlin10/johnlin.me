'use client'

import { motion } from 'motion/react'
import { useTranslations } from 'next-intl'
import styles from './GalleryWall.module.scss'

interface WallHintProps {
  onDismiss: () => void
}

/**
 * 首訪 coach mark：告訴使用者這面牆可以拖曳探索／捏合或滾輪縮放／點圖看大圖。
 * 只在第一次進牆時出現（記憶在 localStorage），一互動或幾秒後自動淡出。
 * 呈現層而已；顯示與否、計時、記憶都在 GalleryWall。
 *
 * 動畫掛在外層置中 dock（用 flex 置中，不用 transform），內層按鈕才不會跟
 * motion 管的 transform 打架——motion 會接管 transform，CSS 的 translateX(-50%) 會失效。
 */
export default function WallHint({ onDismiss }: WallHintProps) {
  const t = useTranslations('GalleryPage.hint')
  return (
    <motion.div
      className={styles.hintDock}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <button type="button" className={styles.hint} onClick={onDismiss}>
        {/* 依輸入裝置擇一顯示（CSS 判斷），伺服器端渲染也不會閃 */}
        <span className={styles.hintTouch}>{t('explore')}</span>
        <span className={styles.hintMouse}>{t('exploreMouse')}</span>
      </button>
    </motion.div>
  )
}
