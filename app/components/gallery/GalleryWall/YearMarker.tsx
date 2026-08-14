'use client'

import { motion, type MotionValue } from 'motion/react'
import styles from './GalleryWall.module.scss'

interface YearMarkerProps {
  year: number
  /** 該年份組最左欄的左緣（牆座標） */
  x: number
  /** 年份大字頂端 y（牆座標，正值，落在照片上方的留白帶裡） */
  y: number
  /** 反向 LOD：縮小時顯示（當導航錨點），放大後淡出 */
  opacity: MotionValue<number>
}

export default function YearMarker({ year, x, y, opacity }: YearMarkerProps) {
  return (
    <motion.span
      className={styles.yearMarker}
      style={{ left: x, top: y, opacity }}
      aria-hidden="true"
    >
      {year}
    </motion.span>
  )
}
