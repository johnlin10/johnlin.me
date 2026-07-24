'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
  /** 進場延遲（秒），用於段內元素依序淡入 */
  delay?: number
  /** 起始位移（px），reduced-motion 時自動忽略 */
  y?: number
  /** 一次性（預設）或每次進入視窗都播放 */
  once?: boolean
  as?: 'div' | 'section' | 'li' | 'article' | 'p' | 'span'
}

/**
 * 捲動進場淡入包裝。克制的 fade + 上浮，尊重 prefers-reduced-motion
 * （偏好減少動態時只做 opacity，不做位移）。
 *
 * 觸發用 `amount`（元素露出約 18% 即觸發），不用負的 rootMargin——
 * 負 margin 要求元素深入視窗一段距離，頁面最底部的段落有時因此不觸發。
 */
export default function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
  once = true,
  as = 'div',
}: Props) {
  const reduce = useReducedMotion()
  const MotionTag = motion[as]

  return (
    <MotionTag
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.18 }}
      transition={{
        duration: 0.7,
        delay,
        ease: [0.23, 1, 0.32, 1],
      }}
    >
      {children}
    </MotionTag>
  )
}
