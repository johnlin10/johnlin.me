'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useTransform,
  useMotionValueEvent,
} from 'motion/react'
import { COL_W, packWall } from '@/app/lib/photos/layout'
import { fitTransform, fitWallTransform, type Size } from '@/app/lib/photos/geometry'
import { yearMarkerOpacity } from '@/app/lib/photos/lod'
import type { Photo } from '@/app/types/photo'
import type { SupportedLocale } from '@/app/types/blog'
import { usePanZoom } from './usePanZoom'
import { useFocusMachine } from './useFocusMachine'
import WallPhoto from './WallPhoto'
import PrefacePanel from './PrefacePanel'
import YearMarker from './YearMarker'
import WallControls from './WallControls'
import FocusOverlay from './FocusOverlay'
import GalleryModeToggle, { type GalleryViewMode } from './GalleryModeToggle'
import WallHint from './WallHint'
import styles from './GalleryWall.module.scss'

interface GalleryWallProps {
  photos: Photo[]
  locale: SupportedLocale
  mode: GalleryViewMode
  onModeChange: (mode: GalleryViewMode) => void
}

const INITIAL_PHOTO_WIDTH = 240
const COACH_STORAGE_KEY = 'gallery:coach-seen'
const COACH_AUTO_HIDE_MS = 6000

/** 讀 CSS 變數並轉成 px 數字，SSR／變數缺失時退回 fallback。 */
function cssPx(varName: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim()
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : fallback
}

/**
 * 牆頂端要淨空浮動 header 的舒適留白（螢幕像素）：header 視覺高度 + 一段呼吸空間。
 * 初始鏡頭（看見前言）與「看整面牆」按鈕都用同一個值，維持一致的留白節奏。
 */
function headerClearance(): number {
  return cssPx('--header-height', 72) + cssPx('--space-6', 24)
}

export default function GalleryWall({
  photos,
  locale,
  mode,
  onModeChange,
}: GalleryWallProps) {
  const reduceMotion = !!useReducedMotion()
  const layout = useMemo(() => packWall(photos), [photos])
  const wall: Size = useMemo(
    () => ({ width: layout.width, height: layout.height }),
    [layout.width, layout.height]
  )

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 })

  // 首訪 coach mark：一互動或計時到就淡出並記住。dismissCoach 要先於 pz 定義，
  // 因為 pz 的 onGestureStart 會用它（首次手勢即收起提示）。
  const [showCoach, setShowCoach] = useState(false)
  const coachTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dismissCoach = useCallback(() => {
    setShowCoach(false)
    if (coachTimer.current) clearTimeout(coachTimer.current)
    try {
      localStorage.setItem(COACH_STORAGE_KEY, '1')
    } catch {
      // 隱私模式寫不進去就算了，下次再顯示一次無妨
    }
  }, [])

  const minScale = useMemo(() => {
    if (viewport.width === 0) return 0.1
    return fitWallTransform(wall, viewport).scale
  }, [wall, viewport])

  const maxScale = useMemo(() => {
    if (viewport.width === 0) return 4
    let maxFit = 0
    for (const cell of layout.cells) {
      const s = fitTransform(
        { x: cell.x, y: cell.y, w: cell.w, h: cell.photoH },
        viewport
      ).scale
      if (s > maxFit) maxFit = s
    }
    return Math.max(maxFit * 1.6, minScale * 3)
  }, [layout.cells, viewport, minScale])

  const pz = usePanZoom({
    wall,
    viewport,
    minScale,
    maxScale,
    onGestureStart: dismissCoach,
    onGestureEnd: (kind) => {
      if (kind === 'zoom') fm.onZoomSettled()
    },
    // 雙擊：縮放切換。縮著時放大到約一張照片寬（不到磁吸門檻、不強制聚焦），
    // 已放大時縮回整面牆。聚焦中不處理（focus 自己有縮放）。
    onDoubleTap: (point) => {
      if (fm.focusedSlug) return
      const s = pz.getTransform().scale
      const zoomedTarget = Math.min(maxScale, (viewport.width * 0.72) / COL_W)
      if (s < zoomedTarget * 0.9) {
        pz.zoomAtPoint(zoomedTarget, point, true)
      } else {
        pz.animateTo(fitWallTransform(wall, viewport, 0.04, headerClearance()))
      }
    },
    // focus 中左右滑換照片（手勢在 usePanZoom 判定：只有照片未放大、水平不可平移時才觸發）
    onFocusSwipe: (dir) => {
      if (fm.focusedSlug) fm.navigate(dir)
    },
  })
  const { setTransform, animateTo, zoomBy, bindViewport, panByScreen } = pz

  const fm = useFocusMachine({
    pz,
    cells: layout.cells,
    wall,
    viewport,
    locale,
    reduceMotion,
  })
  const focusedCell = fm.focusedSlug
    ? fm.cellBySlug.get(fm.focusedSlug)
    : undefined

  // callback ref：本地 ref + usePanZoom 原生 listener + ResizeObserver
  const roRef = useRef<ResizeObserver | null>(null)
  const setViewportNode = useCallback(
    (node: HTMLDivElement | null) => {
      viewportRef.current = node
      bindViewport(node)
      roRef.current?.disconnect()
      if (node) {
        const measure = () =>
          setViewport({ width: node.clientWidth, height: node.clientHeight })
        measure()
        roRef.current = new ResizeObserver(measure)
        roRef.current.observe(node)
      }
    },
    [bindViewport]
  )

  // 初始鏡頭：前言標題對齊頁面左上角（扣掉 header）、留舒適留白，
  // 讓使用者一進頁面就看得出這是哪一頁；照片約 240px。
  const initialised = useRef(false)
  useEffect(() => {
    if (initialised.current || viewport.width === 0) return
    initialised.current = true
    const s0 = Math.max(minScale, INITIAL_PHOTO_WIDTH / COL_W)
    const marginX = cssPx('--page-gutter', 48)
    const marginY = headerClearance()
    setTransform({ x: marginX, y: marginY, scale: s0 })
  }, [viewport, minScale, setTransform])

  // 鎖整頁捲動，並壓掉瀏覽器的橫向滑動返回手勢（overscroll-behavior 要 html + body
  // 都設，只設 html 不夠）。iOS Safari 的邊緣返回手勢無視 overscroll-behavior，需真機
  // 驗證，靠 viewport 的 touch-action:none 與「互動不從最邊緣起手」緩解。
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prev = {
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverscroll: body.style.overscrollBehavior,
    }
    html.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    body.style.overscrollBehavior = 'none'
    return () => {
      html.style.overflow = prev.htmlOverflow
      html.style.overscrollBehavior = prev.htmlOverscroll
      body.style.overscrollBehavior = prev.bodyOverscroll
    }
  }, [])

  // 進入單張聚焦時淡出浮動 header（避免暗背景與咖啡色 header 割裂）
  useEffect(() => {
    const html = document.documentElement
    if (fm.focusedSlug) html.dataset.photoFocus = 'true'
    else delete html.dataset.photoFocus
    return () => {
      delete html.dataset.photoFocus
    }
  }, [fm.focusedSlug])

  // 首訪提示：只在第一次進牆時出現一次，之後記住不再顯示
  useEffect(() => {
    let seen = false
    try {
      seen = localStorage.getItem(COACH_STORAGE_KEY) === '1'
    } catch {
      // 讀不到就當沒看過，頂多多顯示一次
    }
    if (seen) return
    setShowCoach(true)
    coachTimer.current = setTimeout(dismissCoach, COACH_AUTO_HIDE_MS)
    return () => {
      if (coachTimer.current) clearTimeout(coachTimer.current)
    }
  }, [dismissCoach])

  // 沉降後的 scale（用於 LOD 與 sizes，避免每幀 thrash）
  const [settledScale, setSettledScale] = useState(minScale)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useMotionValueEvent(pz.scale, 'change', (s) => {
    if (settleTimer.current) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => setSettledScale(s), 140)
  })

  // sizes 只升不降（瀏覽器不會為變小的 sizes 重抓小圖）
  const sizesPxRef = useRef(0)
  const sizesPx = Math.max(
    sizesPxRef.current,
    Math.round(COL_W * settledScale)
  )
  sizesPxRef.current = sizesPx

  const yearOpacity = useTransform(pz.scale, (s) => yearMarkerOpacity(s))

  // 控制列淡出的基準：聚焦照片（含資訊卡）fit 進視窗所需的 scale
  const focusFitScale = focusedCell ? fm.fitScaleOf(focusedCell) : 1

  const handleFitWall = useCallback(() => {
    if (viewport.width === 0) return
    animateTo(fitWallTransform(wall, viewport, 0.04, headerClearance()))
  }, [animateTo, wall, viewport])


  // Tab 到某張照片時把鏡頭帶過去，否則焦點會落在螢幕外（違反 WCAG 2.4.11）
  const handleFocusCapture = useCallback(
    (e: React.FocusEvent) => {
      if (fm.focusedSlug) return
      const id = (e.target as HTMLElement).dataset?.photoId
      if (!id) return
      const cell = layout.cells.find((c) => c.photo.id === id)
      if (!cell) return
      const s = pz.getTransform().scale
      const cx = cell.x + cell.w / 2
      const cy = cell.y + cell.photoH / 2
      animateTo({
        scale: s,
        x: viewport.width / 2 - cx * s,
        y: viewport.height / 2 - cy * s,
      })
    },
    [fm.focusedSlug, layout.cells, pz, animateTo, viewport]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (fm.focusedSlug) {
        if (e.key === 'Escape') {
          e.preventDefault()
          fm.stepBack()
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          fm.navigate(-1)
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          fm.navigate(1)
        }
        return
      }
      const step = e.shiftKey ? 0.5 : 0.1
      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault()
          zoomBy(1.25)
          break
        case '-':
        case '_':
          e.preventDefault()
          zoomBy(1 / 1.25)
          break
        case '0':
          e.preventDefault()
          handleFitWall()
          break
        case 'ArrowLeft':
          e.preventDefault()
          panByScreen(viewport.width * step, 0)
          break
        case 'ArrowRight':
          e.preventDefault()
          panByScreen(-viewport.width * step, 0)
          break
        case 'ArrowUp':
          e.preventDefault()
          panByScreen(0, viewport.height * step)
          break
        case 'ArrowDown':
          e.preventDefault()
          panByScreen(0, -viewport.height * step)
          break
      }
    },
    [fm, zoomBy, handleFitWall, panByScreen, viewport]
  )

  return (
    <div
      ref={setViewportNode}
      className={styles.viewport}
      tabIndex={0}
      role="application"
      aria-roledescription={locale === 'en' ? 'Photo wall' : '照片牆'}
      onPointerDown={pz.onPointerDown}
      onPointerMove={pz.onPointerMove}
      onPointerUp={pz.onPointerUp}
      onPointerCancel={pz.onPointerCancel}
      onKeyDown={handleKeyDown}
      onFocusCapture={handleFocusCapture}
    >
      <motion.div
        className={styles.wall}
        style={{
          width: wall.width,
          height: wall.height,
          x: pz.x,
          y: pz.y,
          scale: pz.scale,
          transformOrigin: '0 0',
        }}
      >
        <PrefacePanel
          x={layout.preface.x}
          y={layout.preface.y}
          w={layout.preface.w}
          h={layout.preface.h}
        />

        {layout.groups.map((g) => (
          <YearMarker
            key={g.year}
            year={g.year}
            x={g.x}
            y={layout.yearMarkerY}
            opacity={yearOpacity}
          />
        ))}

        {layout.cells.map((cell) => (
          <WallPhoto
            key={cell.photo.id}
            cell={cell}
            locale={locale}
            isFocused={cell.photo.slug === fm.focusedSlug}
            tier={sizesPx}
            onFocusCardResize={fm.reportFocusCardHeight}
            onActivate={fm.activate}
          />
        ))}
      </motion.div>

      {focusedCell && (
        <FocusOverlay
          scale={pz.scale}
          fitScale={focusFitScale}
          canPrev={
            layout.cells.findIndex((c) => c.photo.slug === fm.focusedSlug) > 0
          }
          canNext={
            layout.cells.findIndex((c) => c.photo.slug === fm.focusedSlug) <
            layout.cells.length - 1
          }
          onClose={() => fm.exit(false)}
          onPrev={() => fm.navigate(-1)}
          onNext={() => fm.navigate(1)}
          escHint={false}
        />
      )}

      <WallControls
        onZoomIn={() => zoomBy(1.4)}
        onZoomOut={() => zoomBy(1 / 1.4)}
        onFitWall={handleFitWall}
      />

      {/* 牆↔清單切換：聚焦單張時淡出，不干擾看照片 */}
      {!fm.focusedSlug && (
        <div className={styles.modeDock}>
          <GalleryModeToggle mode={mode} onChange={onModeChange} />
        </div>
      )}

      <AnimatePresence>
        {showCoach && !fm.focusedSlug && <WallHint onDismiss={dismissCoach} />}
      </AnimatePresence>
    </div>
  )
}
