import { useCallback, useEffect, useRef, useState } from 'react'
import { animate, useMotionValue } from 'motion/react'
import {
  anchorZoom,
  clampScale,
  clampTranslate,
  clampTranslateToRect,
  type Rect,
  type Size,
  type Transform,
} from '@/app/lib/photos/geometry'

interface PanZoomOptions {
  /** 牆座標尺寸（含前言），resize 不變，但 minScale 會重算 */
  wall: Size
  /** 目前 viewport 尺寸；resize 時傳新值進來 */
  viewport: Size
  minScale: number
  maxScale: number
  /** 手勢開始／結束回呼（供上層做 will-change 或 focus 判定） */
  onGestureStart?: () => void
  onGestureEnd?: (kind: 'pan' | 'zoom') => void
  /** 雙擊（觸控／滑鼠）：回傳 viewport 內座標，供上層做縮放切換 */
  onDoubleTap?: (point: { x: number; y: number }) => void
  /**
   * focus 中、照片未放大（水平不可平移）時的左右滑：dir=-1 上一張、+1 下一張。
   * 只有設了 clampRect（focus）且該照片縮放後寬度未超過視窗時才會觸發。
   */
  onFocusSwipe?: (dir: -1 | 1) => void
}

const MOUSE_ZOOM_STEP = 0.0018 // 滑鼠滾輪每格的縮放係數
const TRACKPAD_PINCH_STEP = 0.01 // 觸控板 ctrl+wheel 捏合係數

// 觸控慣性／點擊判定參數
const TAP_MOVE_PX = 10 // 移動小於此值才算「點按」而非拖曳
const TAP_TIME_MS = 250 // 按下到放開短於此值才算點按
const DOUBLE_TAP_MS = 300 // 兩次點按間隔
const DOUBLE_TAP_PX = 40 // 兩次點按位置容差
const FLICK_MIN_SPEED = 0.05 // px/ms，低於此不觸發慣性（約 50px/s）
const INERTIA_FRICTION = 0.94 // 每 ~16.7ms 的速度衰減係數
const SWIPE_MIN_PX = 48 // focus 中左右滑換照片的最小水平位移
const SWIPE_DOMINANCE = 1.3 // 水平位移要大於垂直位移的倍率，才算「左右滑」

/**
 * 攝影牆的平移／縮放手勢引擎。只吐 x/y/scale 三個 motion value 與一組事件處理器，
 * 不含任何 focus／磁吸語意（那是 Stage 5）。
 *
 * 座標模型：牆用 transform: translate(x,y) scale(s)、transform-origin 0 0，
 * 所以螢幕點 = translate + 牆點 × scale。錨點縮放讓游標／雙指中心底下那一點不動。
 */
export function usePanZoom({
  wall,
  viewport,
  minScale,
  maxScale,
  onGestureStart,
  onGestureEnd,
  onDoubleTap,
  onFocusSwipe,
}: PanZoomOptions) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const scale = useMotionValue(minScale)
  const [viewportEl, setViewportEl] = useState<HTMLElement | null>(null)

  // 最新的尺寸與縮放界限放進 ref，事件處理器才不會抓到舊 closure
  const cfg = useRef({ wall, viewport, minScale, maxScale })
  cfg.current = { wall, viewport, minScale, maxScale }

  // 回呼放 ref：wheel 原生 listener 與手勢處理器才不會因 prop 每次變動而重掛
  const callbacks = useRef({
    onGestureStart,
    onGestureEnd,
    onDoubleTap,
    onFocusSwipe,
  })
  callbacks.current = { onGestureStart, onGestureEnd, onDoubleTap, onFocusSwipe }

  // focus 中把平移夾在照片矩形內（而非整面牆）；null = 用整面牆的 clamp
  const clampRect = useRef<Rect | null>(null)

  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null
  )
  const pinchStart = useRef<{
    dist: number
    scale: number
    // 起始時，雙指中點底下的牆座標點（縮放＋平移的共同錨點）
    wallX: number
    wallY: number
  } | null>(null)
  const gesturing = useRef(false)
  const wheelSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 本次手勢是否曾有兩指（放開最後一指時，據此把手勢結束報成 'zoom' 讓磁吸生效）
  const pinchedGesture = useRef(false)
  // 慣性平移：速度取樣（EMA）＋ rAF 迴圈
  const panSample = useRef<{ x: number; y: number; t: number } | null>(null)
  const panVel = useRef({ x: 0, y: 0 })
  const inertiaRaf = useRef<number | null>(null)
  // 點按／雙擊判定
  const tapStart = useRef<{ x: number; y: number; t: number } | null>(null)
  const lastTap = useRef<{ x: number; y: number; t: number } | null>(null)
  // 本次手勢是否為觸控／觸控筆（慣性只給觸控，滑鼠拖曳維持直接、不飄）
  const touchGesture = useRef(false)

  const current = useCallback(
    (): Transform => ({ x: x.get(), y: y.get(), scale: scale.get() }),
    [x, y, scale]
  )

  /** 依目前是整面牆還是 focus 照片，選對的 clamp。 */
  const clampT = useCallback((t: Transform): Transform => {
    const { wall, viewport } = cfg.current
    return clampRect.current
      ? clampTranslateToRect(t, clampRect.current, viewport)
      : clampTranslate(t, wall, viewport)
  }, [])

  /** 套用一個新 transform，clamp 後寫回 motion values。 */
  const apply = useCallback(
    (t: Transform) => {
      const { minScale, maxScale } = cfg.current
      const s = clampScale(t.scale, minScale, maxScale)
      const clamped = clampT({ ...t, scale: s })
      x.set(clamped.x)
      y.set(clamped.y)
      scale.set(s)
    },
    [x, y, scale, clampT]
  )

  /** 以某個螢幕座標點為錨點縮放到 nextScale。 */
  const zoomAtPoint = useCallback(
    (nextScale: number, point: { x: number; y: number }, animated = false) => {
      const { minScale, maxScale } = cfg.current
      const s = clampScale(nextScale, minScale, maxScale)
      const zoomed = anchorZoom(current(), s, point)
      const clamped = clampT(zoomed)
      if (animated) {
        const opts = { type: 'spring' as const, stiffness: 320, damping: 38 }
        animate(x, clamped.x, opts)
        animate(y, clamped.y, opts)
        // 動畫「真正結束」時才評估磁吸／退出（+/- 按鈕、鍵盤縮放共用此路徑），
        // 避免用固定 timeout 在 spring 未到位時就讀到中途值而誤判。
        animate(scale, s, {
          ...opts,
          onComplete: () => callbacks.current.onGestureEnd?.('zoom'),
        })
      } else {
        x.set(clamped.x)
        y.set(clamped.y)
        scale.set(s)
      }
    },
    [current, x, y, scale, clampT]
  )

  /** 以視窗中心為錨點，按倍率縮放（給 +/- 按鈕與鍵盤）。 */
  const zoomBy = useCallback(
    (factor: number) => {
      const { viewport } = cfg.current
      const center = { x: viewport.width / 2, y: viewport.height / 2 }
      zoomAtPoint(current().scale * factor, center, true)
    },
    [current, zoomAtPoint]
  )

  /** 動畫到指定 transform（給「看整面牆」、進出 focus）。 */
  const animateTo = useCallback(
    (t: Transform, opts?: { instant?: boolean; clampToWall?: boolean }) => {
      const { wall, viewport, minScale, maxScale } = cfg.current
      const s = clampScale(t.scale, minScale, maxScale)
      // 進出 focus 的動畫目標可能超出當前 clamp 模式，允許指定用整面牆 clamp
      const clamped = opts?.clampToWall
        ? clampTranslate({ ...t, scale: s }, wall, viewport)
        : clampT({ ...t, scale: s })
      if (opts?.instant) {
        x.set(clamped.x)
        y.set(clamped.y)
        scale.set(s)
        return
      }
      const spring = { type: 'spring' as const, stiffness: 300, damping: 38 }
      animate(x, clamped.x, spring)
      animate(y, clamped.y, spring)
      animate(scale, s, spring)
    },
    [x, y, scale, clampT]
  )

  const setClampRect = useCallback((rect: Rect | null) => {
    clampRect.current = rect
  }, [])

  /** 以螢幕像素平移（給鍵盤方向鍵）。 */
  const panByScreen = useCallback(
    (dx: number, dy: number) => {
      const t = current()
      apply({ scale: t.scale, x: t.x + dx, y: t.y + dy })
    },
    [current, apply]
  )

  /** 立即設定 transform（無動畫，給初始鏡頭）。 */
  const setTransform = useCallback(
    (t: Transform) => apply(t),
    [apply]
  )

  //* ==================== 慣性平移（甩動）====================

  const stopInertia = useCallback(() => {
    if (inertiaRaf.current !== null) {
      cancelAnimationFrame(inertiaRaf.current)
      inertiaRaf.current = null
    }
  }, [])

  /** 以放手時的速度（px/ms）啟動慣性滑行；apply 會夾邊界，到邊即止。 */
  const startInertia = useCallback(
    (vx: number, vy: number) => {
      stopInertia()
      if (clampRect.current) return // focus 模式不做慣性
      let velX = vx
      let velY = vy
      let last = performance.now()
      const stepFrame = (now: number) => {
        const dt = Math.min(48, now - last)
        last = now
        const t = current()
        apply({ scale: t.scale, x: t.x + velX * dt, y: t.y + velY * dt })
        const decay = Math.pow(INERTIA_FRICTION, dt / 16.67)
        velX *= decay
        velY *= decay
        if (Math.hypot(velX, velY) > 0.015) {
          inertiaRaf.current = requestAnimationFrame(stepFrame)
        } else {
          inertiaRaf.current = null
        }
      }
      inertiaRaf.current = requestAnimationFrame(stepFrame)
    },
    [stopInertia, current, apply]
  )

  //* ==================== Pointer（觸控／拖曳）====================

  const midpoint = () => {
    const pts = [...pointers.current.values()]
    return {
      x: (pts[0].x + pts[1].x) / 2,
      y: (pts[0].y + pts[1].y) / 2,
    }
  }
  const distance = () => {
    const pts = [...pointers.current.values()]
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
  }

  const beginGesture = useCallback(() => {
    if (!gesturing.current) {
      gesturing.current = true
      callbacks.current.onGestureStart?.()
    }
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // setPointerCapture 對已失效／合成的 pointerId 會丟例外，包起來不讓它中斷後續
      try {
        ;(e.target as Element).setPointerCapture?.(e.pointerId)
      } catch {
        /* 忽略：抓不到 capture 不影響平移邏輯 */
      }
      stopInertia() // 再次按下就接管，停掉還在滑的慣性
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      beginGesture()

      if (pointers.current.size === 2) {
        pinchedGesture.current = true
        const mid = midpoint()
        const t = current()
        pinchStart.current = {
          dist: distance(),
          scale: t.scale,
          wallX: (mid.x - t.x) / t.scale,
          wallY: (mid.y - t.y) / t.scale,
        }
        panStart.current = null
      } else if (pointers.current.size === 1) {
        pinchedGesture.current = false
        touchGesture.current = e.pointerType !== 'mouse'
        const t = current()
        panStart.current = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y }
        // 慣性速度取樣 + 點按判定起點
        panSample.current = { x: e.clientX, y: e.clientY, t: performance.now() }
        panVel.current = { x: 0, y: 0 }
        tapStart.current = { x: e.clientX, y: e.clientY, t: performance.now() }
      }
    },
    [beginGesture, current, stopInertia]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (pointers.current.size === 2 && pinchStart.current) {
        // 雙指：以中點為錨點縮放，中點移動時同步平移
        const start = pinchStart.current
        const mid = midpoint()
        const { minScale, maxScale } = cfg.current
        const nextScale = clampScale(
          start.scale * (distance() / start.dist),
          minScale,
          maxScale
        )
        apply({
          scale: nextScale,
          x: mid.x - start.wallX * nextScale,
          y: mid.y - start.wallY * nextScale,
        })
      } else if (pointers.current.size === 1 && panStart.current) {
        const start = panStart.current
        apply({
          scale: current().scale,
          x: start.tx + (e.clientX - start.x),
          y: start.ty + (e.clientY - start.y),
        })
        // 慣性速度：對瞬時速度做 EMA，末端幾筆決定甩動力道
        const prev = panSample.current
        const now = performance.now()
        if (prev) {
          const dt = Math.max(1, now - prev.t)
          const ix = (e.clientX - prev.x) / dt
          const iy = (e.clientY - prev.y) / dt
          panVel.current = {
            x: ix * 0.75 + panVel.current.x * 0.25,
            y: iy * 0.75 + panVel.current.y * 0.25,
          }
        }
        panSample.current = { x: e.clientX, y: e.clientY, t: now }
      }
    },
    [apply, current]
  )

  const endPointer = useCallback(
    (e: React.PointerEvent) => {
      pointers.current.delete(e.pointerId)
      if (pointers.current.size < 2) pinchStart.current = null
      // 兩指變一指時，重設 pan 起點與速度取樣，避免跳動
      if (pointers.current.size === 1) {
        const [only] = [...pointers.current.values()]
        const t = current()
        panStart.current = { x: only.x, y: only.y, tx: t.x, ty: t.y }
        panSample.current = { x: only.x, y: only.y, t: performance.now() }
        panVel.current = { x: 0, y: 0 }
      }
      if (pointers.current.size === 0) {
        panStart.current = null
        gesturing.current = false

        const start = tapStart.current
        const now = performance.now()
        const moved = start
          ? Math.hypot(e.clientX - start.x, e.clientY - start.y)
          : Infinity
        const dur = start ? now - start.t : Infinity
        const isTap =
          !pinchedGesture.current && moved < TAP_MOVE_PX && dur < TAP_TIME_MS

        if (isTap) {
          const prev = lastTap.current
          const isDouble =
            !!prev &&
            now - prev.t < DOUBLE_TAP_MS &&
            Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < DOUBLE_TAP_PX
          if (isDouble) {
            lastTap.current = null
            const rect = viewportEl?.getBoundingClientRect()
            if (rect) {
              callbacks.current.onDoubleTap?.({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
              })
            }
          } else {
            lastTap.current = { x: e.clientX, y: e.clientY, t: now }
          }
        } else if (!pinchedGesture.current) {
          // 非點按的單指拖曳放手
          const cr = clampRect.current
          const t = current()
          // focus 中、照片縮放後寬度沒超過視窗（水平不能平移，拖了也只會彈回置中）
          const horizPinned =
            !!cr && cr.w * t.scale <= cfg.current.viewport.width + 1
          const dx = start ? e.clientX - start.x : 0
          const dy = start ? e.clientY - start.y : 0
          if (
            horizPinned &&
            Math.abs(dx) > SWIPE_MIN_PX &&
            Math.abs(dx) > Math.abs(dy) * SWIPE_DOMINANCE
          ) {
            // 左右滑換照片：往右滑（dx>0）＝上一張，往左滑＝下一張
            callbacks.current.onFocusSwipe?.(dx > 0 ? -1 : 1)
          } else if (touchGesture.current && !cr) {
            // 牆面觸控單指拖曳放手 → 慣性甩動（捏合不甩；滑鼠拖曳維持直接、不飄）
            if (
              Math.hypot(panVel.current.x, panVel.current.y) > FLICK_MIN_SPEED
            ) {
              startInertia(panVel.current.x, panVel.current.y)
            }
          }
        }

        const wasPinch = pinchedGesture.current
        pinchedGesture.current = false
        callbacks.current.onGestureEnd?.(wasPinch ? 'zoom' : 'pan')
      }
    },
    [current, viewportEl, startInertia]
  )

  //* ==================== Wheel（滑鼠滾輪／觸控板）====================
  // React 的 onWheel 無法可靠 preventDefault，用原生 listener + passive:false。

  useEffect(() => {
    if (!viewportEl) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      stopInertia()
      const rect = viewportEl.getBoundingClientRect()
      const point = { x: e.clientX - rect.left, y: e.clientY - rect.top }

      // 滾輪一律以游標為基點縮放（平移改用按住拖曳）——不再嘗試分辨滑鼠／觸控板，
      // 因為 macOS 的滾輪加速與 Magic Mouse 會讓那套偵測誤判成觸控板而變成平移。
      // ctrl/⌘＝觸控板 pinch，用較細步進；主要分量取垂直，無垂直分量時退用水平。
      const primary = e.deltaY !== 0 ? e.deltaY : e.deltaX
      const step = e.ctrlKey ? TRACKPAD_PINCH_STEP : MOUSE_ZOOM_STEP
      // 夾住單次事件的縮放倍率，避免 macOS 滾輪加速造成暴衝
      const factor = Math.min(1.6, Math.max(0.625, 1 - primary * step))
      zoomAtPoint(current().scale * factor, point)

      // 220ms 靜止＝縮放手勢結束，供上層評估磁吸／退出
      if (wheelSettleTimer.current) clearTimeout(wheelSettleTimer.current)
      wheelSettleTimer.current = setTimeout(() => {
        callbacks.current.onGestureEnd?.('zoom')
      }, 220)
    }

    viewportEl.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewportEl.removeEventListener('wheel', handleWheel)
  }, [viewportEl, current, zoomAtPoint, stopInertia])

  // 卸載時停掉還在跑的慣性 rAF
  useEffect(() => stopInertia, [stopInertia])

  // iOS Safari 的原生縮放手勢（userScalable:false 對它無效），整頁攔掉
  useEffect(() => {
    if (!viewportEl) return
    const prevent = (e: Event) => e.preventDefault()
    viewportEl.addEventListener('gesturestart', prevent)
    viewportEl.addEventListener('gesturechange', prevent)
    viewportEl.addEventListener('gestureend', prevent)
    return () => {
      viewportEl.removeEventListener('gesturestart', prevent)
      viewportEl.removeEventListener('gesturechange', prevent)
      viewportEl.removeEventListener('gestureend', prevent)
    }
  }, [viewportEl])

  return {
    x,
    y,
    scale,
    bindViewport: setViewportEl,
    onPointerDown,
    onPointerMove,
    onPointerUp: endPointer,
    onPointerCancel: endPointer,
    zoomBy,
    animateTo,
    setTransform,
    zoomAtPoint,
    setClampRect,
    panByScreen,
    getTransform: current,
  }
}
