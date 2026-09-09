'use client'

import { useTranslations } from 'next-intl'
import type { CSSProperties } from 'react'
import styles from './GalleryWall.module.scss'

interface PrefacePanelProps {
  x: number
  y: number
  w: number
  h: number
  onViewPhotos: () => void
}

/**
 * 牆最左端的策展前言面板（在牆座標系內，跟著牆一起縮放平移）。
 * 使用者第一眼看到它，往右滑進入最新年份的照片。手機螢幕窄，面板常常就
 * 塞滿整個畫面，看不出右邊還有牆，所以底下放一個顯眼按鈕直接把鏡頭帶過去。
 * 通往獨立理念頁的連結留到之後版本 —— 這裡先放標題與簡介。
 */
export default function PrefacePanel({
  x,
  y,
  w,
  h,
  onViewPhotos,
}: PrefacePanelProps) {
  const t = useTranslations('GalleryPage')
  const style: CSSProperties = { left: x, top: y, width: w, height: h }

  return (
    <div className={styles.preface} style={style}>
      <div className={styles.prefaceInner}>
        <p className={styles.prefaceEyebrow}>{t('page_title')}</p>
        <p className={styles.prefaceLead}>{t('description')}</p>
        <button
          type="button"
          className={styles.prefaceCta}
          onClick={onViewPhotos}
        >
          {t('viewPhotos')}
          <span className={styles.prefaceCtaArrow} aria-hidden="true">
            →
          </span>
        </button>
      </div>
    </div>
  )
}
