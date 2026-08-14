'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '@/app/components/Icon/Icon'
import style from './Popover.module.scss'

export interface PopoverProps {
  isOpen: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
  title?: string
  children: React.ReactNode
  placement?: 'top' | 'bottom'
  width?: number
  className?: string
}

/**
 * 通用懸浮彈窗組件 (Popover)
 * 自動依據 anchorRef 計算位置，並補償左右邊緣避開畫面裁切。
 */
export default function Popover({
  isOpen,
  onClose,
  anchorRef,
  title,
  children,
  placement = 'top',
  width = 280,
  className = '',
}: PopoverProps) {
  const [mounted, setMounted] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  const [coords, setCoords] = useState<{
    top: number
    left: number
    arrowLeft: number
    placement: 'top' | 'bottom'
  }>({
    top: 0,
    left: 0,
    arrowLeft: 140,
    placement,
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  // 計算並邊界校正 Popover 的 fixed 位置
  useLayoutEffect(() => {
    if (!isOpen || !anchorRef.current || !popoverRef.current) return

    const updatePosition = () => {
      const anchor = anchorRef.current
      const popover = popoverRef.current
      if (!anchor || !popover) return

      const anchorRect = anchor.getBoundingClientRect()
      const popoverRect = popover.getBoundingClientRect()

      const gutter = 12
      const pWidth = popoverRect.width || width
      const pHeight = popoverRect.height || 120

      const anchorCenterX = anchorRect.left + anchorRect.width / 2

      // 水平夾取：確保 popover 留在 Viewport 內部 (gutter ~ window.innerWidth - gutter)
      const idealLeft = anchorCenterX - pWidth / 2
      const maxLeft = Math.max(gutter, window.innerWidth - pWidth - gutter)
      const clampedLeft = Math.max(gutter, Math.min(idealLeft, maxLeft))

      // 指針箭頭對準 anchor 中心
      const arrowLeft = Math.max(
        20,
        Math.min(anchorCenterX - clampedLeft, pWidth - 20),
      )

      // 垂直夾取：預設 top，若上方空間不足自動切換為 bottom
      let actualPlacement = placement
      let computedTop = anchorRect.top - pHeight - 10

      if (actualPlacement === 'top' && computedTop < gutter) {
        actualPlacement = 'bottom'
      }

      if (actualPlacement === 'bottom') {
        computedTop = anchorRect.bottom + 10
        if (computedTop + pHeight > window.innerHeight - gutter) {
          computedTop = Math.max(gutter, anchorRect.top - pHeight - 10)
          actualPlacement = 'top'
        }
      }

      setCoords({
        top: computedTop,
        left: clampedLeft,
        arrowLeft,
        placement: actualPlacement,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isOpen, anchorRef, placement, width])

  // 點擊外部與 Escape 鍵監聽
  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose, anchorRef])

  if (!mounted || !isOpen) return null

  return createPortal(
    <div
      ref={popoverRef}
      className={`${style.popover} ${className}`}
      style={{
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: `${width}px`,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 指向 Trigger 元素的邊框箭頭 */}
      <div
        className={`${style.arrow} ${style[coords.placement]}`}
        style={{ left: `${coords.arrowLeft}px` }}
      />

      {title && (
        <div className={style.header}>
          <span className={style.title}>{title}</span>
          <button
            type="button"
            className={style.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="xmark" size="xs" />
          </button>
        </div>
      )}

      <div className={style.content}>{children}</div>
    </div>,
    document.body,
  )
}
