'use client'

import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from 'motion/react'
import { useRef } from 'react'
import type { ReactNode, PointerEvent } from 'react'

type Props = {
  href: string
  className?: string
  children: ReactNode
  /** 最大傾斜角度（度）。刻意克制，保持文青氣質而非浮誇玩具感。 */
  max?: number
}

const SPRING = { stiffness: 150, damping: 18, mass: 0.4 }

/**
 * 指標追蹤的 3D 傾斜連結卡。作品是「可以動手戳戳看」的真實東西，
 * 所以用「互動軸」的動態（跟著游標傾斜）——刻意與「我做三件事」的
 * 「捲動軸」散落視差區隔開，避免整頁都在同一種漂移。
 * 偏好減少動態時：退化為單純連結，保留 CSS hover。
 */
export default function TiltLink({ href, className, children, max = 6 }: Props) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLAnchorElement>(null)
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [max, -max]), SPRING)
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-max, max]), SPRING)

  function handleMove(e: PointerEvent<HTMLAnchorElement>) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    px.set((e.clientX - rect.left) / rect.width - 0.5)
    py.set((e.clientY - rect.top) / rect.height - 0.5)
  }

  function handleLeave() {
    px.set(0)
    py.set(0)
  }

  if (reduce) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {children}
      </a>
    )
  }

  return (
    <motion.a
      ref={ref}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={{ transformPerspective: 800, rotateX, rotateY }}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      {children}
    </motion.a>
  )
}
