import { useRef } from 'react'

// 抽屜收著時，起手要落在左緣這麼寬的範圍內（HIG 最小觸控尺寸）。
const EDGE_ZONE = 44
// 位移超過這個距離才判定方向；縱向就交還給捲動。
const AXIS_SLOP = 10
// 放手前停住超過這麼久（ms）就不算甩動。
const FLING_IDLE = 60
// UIScrollView 的一般減速率，Apple 用它推算甩出去的落點。
const DECELERATION = 0.998

interface Drag {
  startX: number
  startY: number
  originX: number
  width: number
  axis: 'pending' | 'x' | 'y'
  x: number
  lastX: number
  lastT: number
  velocity: number
}

/**
 * 依放手時的位置與速度推算落點，決定抽屜停在開還是關。
 * @param x 抽屜目前的 translateX（-width 全收、0 全開）
 * @param velocity 放手時的橫向速度（px/ms，向右為正）
 * @param width 抽屜寬度
 * @returns 落點過半時為 true（打開）
 */
export function shouldSettleOpen(x: number, velocity: number, width: number) {
  const projected = x + (velocity * DECELERATION) / (1 - DECELERATION)
  return projected > -width / 2
}

/**
 * 讀抽屜當下的 translateX，動畫進行到一半也是實際位置。
 * @param el 抽屜元素
 * @returns translateX（px）
 */
function currentX(el: HTMLElement) {
  return new DOMMatrixReadOnly(getComputedStyle(el).transform).m41
}

/**
 * 手機／平板抽屜的跟手拖曳：從左緣拉出、在抽屜或遮罩上拖回去，開關動畫
 * 進行到一半也能按住接手。拖曳中直接寫 inline style，放手後清掉，交給
 * CSS transition 從當下位置走到目標。
 * @param options.setOpen 放手後決定的開關狀態
 * @param options.desktopBreakpoint 視窗寬度達到這個值就是桌機，不啟用
 * @returns 抽屜與遮罩的 ref，以及要掛在外殼上的觸控事件
 */
export function useDrawerSwipe({
  setOpen,
  desktopBreakpoint,
}: {
  setOpen: (open: boolean) => void
  desktopBreakpoint: number
}) {
  const sidebarRef = useRef<HTMLElement>(null)
  const scrimRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)

  const place = (x: number, width: number) => {
    const sidebar = sidebarRef.current
    const scrim = scrimRef.current
    if (!sidebar || !scrim) return
    sidebar.style.transition = scrim.style.transition = 'none'
    sidebar.style.transform = `translateX(${x}px)`
    scrim.style.opacity = String(1 + x / width)
  }

  const release = () => {
    for (const el of [sidebarRef.current, scrimRef.current]) {
      el?.style.removeProperty('transition')
      el?.style.removeProperty('transform')
      el?.style.removeProperty('opacity')
    }
  }

  const onTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    const sidebar = sidebarRef.current
    const target = e.target as Node
    if (
      !sidebar ||
      e.touches.length > 1 ||
      window.innerWidth >= desktopBreakpoint ||
      // portal 到 body 的彈窗在 React 樹裡仍會冒泡上來
      !e.currentTarget.contains(target)
    ) {
      return
    }
    const touch = e.touches[0]
    const onDrawer =
      sidebar.contains(target) || !!scrimRef.current?.contains(target)
    if (!onDrawer && touch.clientX > EDGE_ZONE) return

    const width = sidebar.offsetWidth
    const x = currentX(sidebar)
    // 動畫中被按住：停在手指下，之後從這裡接手。
    if (x > -width) place(x, width)
    dragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      originX: x,
      width,
      axis: 'pending',
      x,
      lastX: touch.clientX,
      lastT: e.timeStamp,
      velocity: 0,
    }
  }

  const onTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const touch = e.touches[0]
    const dx = touch.clientX - drag.startX
    if (drag.axis === 'pending') {
      const dy = touch.clientY - drag.startY
      if (Math.hypot(dx, dy) < AXIS_SLOP) return
      drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }
    if (drag.axis === 'y') {
      // 被按住的動畫從停下的位置繼續走完
      dragRef.current = null
      release()
      return
    }
    const dt = e.timeStamp - drag.lastT
    if (dt > 0) {
      const v = (touch.clientX - drag.lastX) / dt
      drag.velocity = drag.velocity * 0.2 + v * 0.8
    }
    drag.lastX = touch.clientX
    drag.lastT = e.timeStamp
    drag.x = Math.min(0, Math.max(-drag.width, drag.originX + dx))
    place(drag.x, drag.width)
  }

  const onTouchEnd = (e: React.TouchEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    release()
    if (drag.axis !== 'x') return
    const velocity = e.timeStamp - drag.lastT > FLING_IDLE ? 0 : drag.velocity
    setOpen(shouldSettleOpen(drag.x, velocity, drag.width))
  }

  return {
    sidebarRef,
    scrimRef,
    touchHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel: onTouchEnd,
    },
  }
}
