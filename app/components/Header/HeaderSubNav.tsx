'use client'

import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { useHeaderSubNavSlot } from './HeaderSubNavContext'

/**
 * 把頁面自帶的次導覽（例如 About 的手機章節列）portal 進 Header 的固定列裡，
 * 讓它跟 Header 共用同一塊背景矩形，而不是各自為政、互相用 CSS hack 借位。
 * Header 還沒掛載出掛載點之前（SSR / 尚未 hydrate）不會渲染任何內容。
 */
export default function HeaderSubNav({ children }: { children: ReactNode }) {
  const { slot } = useHeaderSubNavSlot()
  if (!slot) return null
  return createPortal(children, slot)
}
