'use client'

import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
  /**
   * 視差深度（px）。不同卡片給不同值，捲動時各自以不同速度飄移，
   * 製造「隨意擺放、深淺不一」的層次感。值越大＝離鏡頭越近、飄得越多。
   */
  depth?: number
  /** 進場延遲（秒），讓卡片依序浮現而非同時 */
  delay?: number
}

/**
 * 「散落卡片」的單張包裝：三層職責分離，互不搶奪 transform——
 *   外層 ref：純量測捲動進度，本身不位移（避免 transform 回饋抖動）
 *   中層：捲動視差位移（每張 depth 不同 → 深淺層次）
 *   內層：一次性進場淡入上浮
 * 卡片本身的靜置傾斜 / hover 回正由 CSS 負責（見 home.module.scss）。
 * 偏好減少動態時：完全靜止，只保留淡入。
 */
export default function ScatterCard({
  children,
  className,
  depth = 40,
  delay = 0,
}: Props) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const y = useTransform(scrollYProgress, [0, 1], [depth, -depth])

  return (
    <div ref={ref} className={className}>
      <motion.div style={reduce ? undefined : { y }}>
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }}
          whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, delay, ease: [0.23, 1, 0.32, 1] }}
        >
          {children}
        </motion.div>
      </motion.div>
    </div>
  )
}
