import { useCallback, useEffect, useRef, useState } from 'react'
import { animate, useMotionValue } from 'motion/react'

const MAX_SCALE = 4
const DOUBLE_TAP_SCALE = 2.5
const DOUBLE_TAP_MS = 300
const DOUBLE_TAP_DIST_PX = 30
const RESET_THRESHOLD = 1.02

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(1, value))
}

/**
 * 燈箱單張圖片的縮放/平移手勢：雙指縮放、雙擊縮放、桌機 ctrl+wheel（觸控板捏合）。
 * 只作用在目前顯示中的那張圖，換圖時由呼叫端呼叫 reset()。
 *
 * 縮放/位移公式維持「手指下的那一點盡量不動」：panX = (1 - scale) * (anchorX - centerX)。
 * anchor 的量測基準固定在包住圖片、本身不帶任何 transform 的容器（bindContainer 綁的元素），
 * 所以縮放/平移過程中 rect 不會因為自己的 transform 而跑掉。
 */
export function useLightboxZoom(reduceMotion: boolean) {
  const scale = useMotionValue(1)
  const panX = useMotionValue(0)
  const panY = useMotionValue(0)
  const [zoomed, setZoomed] = useState(false)
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null)

  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = useRef<{
    dist: number
    scale: number
    panX: number
    panY: number
  } | null>(null)
  const panStart = useRef<{
    x: number
    y: number
    panX: number
    panY: number
  } | null>(null)
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null)

  const springOptions = reduceMotion
    ? { duration: 0.01 }
    : { type: 'spring' as const, stiffness: 380, damping: 40 }

  const clampPan = useCallback(
    (x: number, y: number, s: number) => {
      const rect = containerEl?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      const maxX = Math.max(0, (rect.width * s - rect.width) / 2)
      const maxY = Math.max(0, (rect.height * s - rect.height) / 2)
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      }
    },
    [containerEl]
  )

  const reset = useCallback(() => {
    scale.set(1)
    panX.set(0)
    panY.set(0)
    setZoomed(false)
    pointers.current.clear()
    pinchStart.current = null
    panStart.current = null
    lastTap.current = null
  }, [scale, panX, panY])

  const zoomTo = useCallback(
    (target: number, anchor?: { x: number; y: number }) => {
      const rect = containerEl?.getBoundingClientRect()
      const cx = rect ? rect.left + rect.width / 2 : 0
      const cy = rect ? rect.top + rect.height / 2 : 0
      const ax = anchor?.x ?? cx
      const ay = anchor?.y ?? cy
      const clamped = clampScale(target)
      const raw = {
        x: (1 - clamped) * (ax - cx),
        y: (1 - clamped) * (ay - cy),
      }
      const next = clamped > 1 ? clampPan(raw.x, raw.y, clamped) : { x: 0, y: 0 }
      animate(scale, clamped, springOptions)
      animate(panX, next.x, springOptions)
      animate(panY, next.y, springOptions)
      setZoomed(clamped > RESET_THRESHOLD)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [scale, panX, panY, containerEl, clampPan]
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()]
        pinchStart.current = {
          dist: Math.hypot(a.x - b.x, a.y - b.y),
          scale: scale.get(),
          panX: panX.get(),
          panY: panY.get(),
        }
        panStart.current = null
        lastTap.current = null
        return
      }

      if (pointers.current.size !== 1) return

      const now = Date.now()
      const tap = lastTap.current
      const isDoubleTap =
        !!tap &&
        now - tap.t < DOUBLE_TAP_MS &&
        Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < DOUBLE_TAP_DIST_PX
      lastTap.current = isDoubleTap ? null : { t: now, x: e.clientX, y: e.clientY }

      if (isDoubleTap) {
        zoomTo(zoomed ? 1 : DOUBLE_TAP_SCALE, { x: e.clientX, y: e.clientY })
        return
      }

      if (scale.get() > 1) {
        panStart.current = {
          x: e.clientX,
          y: e.clientY,
          panX: panX.get(),
          panY: panY.get(),
        }
      }
    },
    [scale, panX, panY, zoomTo, zoomed]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (pointers.current.size === 2 && pinchStart.current) {
        const [a, b] = [...pointers.current.values()]
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        const nextScale = clampScale(
          pinchStart.current.scale * (dist / pinchStart.current.dist)
        )
        const { x, y } = clampPan(
          pinchStart.current.panX,
          pinchStart.current.panY,
          nextScale
        )
        scale.set(nextScale)
        panX.set(x)
        panY.set(y)
        setZoomed(nextScale > RESET_THRESHOLD)
      } else if (pointers.current.size === 1 && panStart.current) {
        const dx = e.clientX - panStart.current.x
        const dy = e.clientY - panStart.current.y
        const { x, y } = clampPan(
          panStart.current.panX + dx,
          panStart.current.panY + dy,
          scale.get()
        )
        panX.set(x)
        panY.set(y)
      }
    },
    [scale, panX, panY, clampPan]
  )

  const endPointer = useCallback(
    (e: React.PointerEvent) => {
      pointers.current.delete(e.pointerId)
      if (pointers.current.size < 2) pinchStart.current = null
      if (pointers.current.size === 0) {
        panStart.current = null
        if (scale.get() <= RESET_THRESHOLD) zoomTo(1)
      }
    },
    [scale, zoomTo]
  )

  // 桌機觸控板捏合是帶 ctrlKey 的 wheel 事件；React 的 onWheel 無法可靠 preventDefault，
  // 需要用原生監聽器加 { passive: false }。
  useEffect(() => {
    if (!containerEl) return
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const next = clampScale(scale.get() - e.deltaY * 0.01)
      const { x, y } = clampPan(panX.get(), panY.get(), next)
      scale.set(next)
      panX.set(x)
      panY.set(y)
      setZoomed(next > RESET_THRESHOLD)
    }
    containerEl.addEventListener('wheel', handleWheel, { passive: false })
    return () => containerEl.removeEventListener('wheel', handleWheel)
  }, [containerEl, scale, panX, panY, clampPan])

  return {
    scale,
    panX,
    panY,
    zoomed,
    bindContainer: setContainerEl,
    onPointerDown,
    onPointerMove,
    onPointerUp: endPointer,
    onPointerCancel: endPointer,
    reset,
  }
}
