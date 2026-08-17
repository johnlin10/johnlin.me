'use client'

import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
  /** 視差深度（px），值越大飄得越多 */
  depth?: number
  /** 進場延遲（秒），讓卡片依序浮現而非同時 */
  delay?: number
}

/**
 * 散落卡片包裝：外層量測捲動進度、中層做視差位移、內層做進場淡入，
 * 三層分開避免互搶 transform。傾斜／hover 回正由 CSS 負責。
 * @param props - {@link Props}
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
