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
import {
  COL_W,
  GAP_X,
  packWall,
  type WallCell,
} from '@/app/lib/photos/wallLayout'
import {
  fitTransform,
  type Size,
  type Transform,
} from '@/app/lib/photos/geometry'
import { yearMarkerOpacity } from '@/app/lib/photos/lod'
import { useIsDesktop } from '@/app/lib/hooks/useIsDesktop'
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
/** 「瀏覽作品」按鈕鎖定的目標鏡頭：留這麼多牆座標寬度，讓第二欄探出頭。 */
const VIEW_PHOTOS_PEEK_PX = 180
const COACH_STORAGE_KEY = 'gallery:coach-seen'
const COACH_AUTO_HIDE_MS = 6000
const VIRTUAL_OVERSCAN_PX = 900
/** 低於這個 scale 就收起照片下方的資訊卡（此時卡片字高不到 7px）。 */
const CARD_LOD_SCALE = 0.5
/** 放大後隔多久才把 sizes 升上去（縮小一律立即生效，見 sizesPx）。 */
const SIZES_UPGRADE_DELAY_MS = 140

/**
 * 把 sizes 吸附到衍生階梯上的下一階。目的是讓這個值只有幾種可能——縮放過程中
 * 就不會每幀換一次 prop、把所有掛載中的 WallPhoto 都重繪一遍。
 *
 * 吸附「到階梯」而不是到 2 的冪次：後者在中段會多跳一階（要 671px 卻去拿
 * w1280 而不是 w960），白花流量。
 */
function snapSizes(scale: number, ladder: number[]): number {
  const px = COL_W * scale
  return ladder.find((w) => w >= px) ?? ladder.at(-1) ?? Math.round(px)
}

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

function visibleCellsForViewport(
  cells: WallCell[],
  viewport: Size,
  transform: Transform,
  focusedSlug: string | null,
): WallCell[] {
  if (viewport.width === 0 || viewport.height === 0 || transform.scale <= 0) {
    return cells
  }

  const { x, y, scale } = transform
  const left = (-x - VIRTUAL_OVERSCAN_PX) / scale
  const right = (viewport.width - x + VIRTUAL_OVERSCAN_PX) / scale
  const top = (-y - VIRTUAL_OVERSCAN_PX) / scale
  const bottom = (viewport.height - y + VIRTUAL_OVERSCAN_PX) / scale

  return cells.filter((cell) => {
    if (cell.photo.slug === focusedSlug) return true
    return (
      cell.x <= right &&
      cell.x + cell.w >= left &&
      cell.y <= bottom &&
      cell.cardY + cell.cardH >= top
    )
  })
}

function sameCells(a: WallCell[], b: WallCell[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].photo.id !== b[i].photo.id) return false
  }
  return true
}

export default function GalleryWall({
  photos,
  locale,
  mode,
  onModeChange,
}: GalleryWallProps) {
  const reduceMotion = !!useReducedMotion()
  const isDesktop = useIsDesktop()
  const layout = useMemo(() => packWall(photos), [photos])
  // 衍生階梯直接從資料取。photoDerivatives.ts 裡雖然有 DERIVATIVE_LADDER，
  // 但那支 import 了 sharp，不能進 client bundle；抄一份又會漂移。
  const ladder = useMemo(
    () =>
      [...new Set(photos.flatMap((p) => p.derivatives.map((d) => d.w)))].sort(
        (a, b) => a - b,
      ),
    [photos],
  )
  const wall: Size = useMemo(
    () => ({ width: layout.width, height: layout.height }),
    [layout.width, layout.height],
  )

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 })
  const [isInteracting, setIsInteracting] = useState(false)

  // 首訪 coach mark：互動或計時到就淡出並記住
  const [showCoach, setShowCoach] = useState(false)
  const coachTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dismissCoach = useCallback(() => {
    setShowCoach(false)
    if (coachTimer.current) clearTimeout(coachTimer.current)
    try {
      localStorage.setItem(COACH_STORAGE_KEY, '1')
    } catch {
      // 靜默忽略
    }
  }, [])

  // 最小縮放＝牆的高度剛好塞滿視窗，橫向靠平移瀏覽。
  // 原本是整面牆連寬度一起塞進來，96 張時每張只剩幾十 px，看不出是什麼照片，
  // 那個級距只是讓瀏覽器多光柵化一次而已。
  const minScale = useMemo(() => {
    if (viewport.height === 0) return 0.1
    return viewport.height / wall.height
  }, [wall.height, viewport.height])

  const maxScale = useMemo(() => {
    if (viewport.width === 0) return 4
    let maxFit = 0
    for (const cell of layout.cells) {
      const s = fitTransform(
        { x: cell.x, y: cell.y, w: cell.w, h: cell.photoH },
        viewport,
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
    onGestureStart: () => {
      dismissCoach()
      setIsInteracting(true)
    },
    onGestureEnd: (kind) => {
      setIsInteracting(false)
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
        pz.zoomAtPoint(minScale, point, true)
      }
    },
    // focus 中左右滑換照片（只有照片未放大、水平不可平移時才觸發）
    onFocusSwipe: (dir) => {
      if (fm.focusedSlug) fm.navigate(dir)
    },
  })
  const {
    setTransform,
    animateTo,
    zoomBy,
    zoomAtPoint,
    bindViewport,
    panByScreen,
    getTransform,
  } = pz

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
    [bindViewport],
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

  // 鎖整頁捲動，並擋掉瀏覽器的橫向滑動返回手勢。
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

  // 進入單張聚焦時淡出浮動 header
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

  // 照片在螢幕上的實際寬（CSS px），DPR 由瀏覽器自己乘上去挑 srcSet 階。
  //
  // 降階立刻生效、升階才防抖，這個不對稱是有原因的：退出 focus 時牆會從放大
  // 狀態彈回去，虛擬化在這段動畫裡就把照片掛回來了。若 sizes 還停在放大時的
  // 高標，這些新掛的照片會去載 w960（實測一次進出多抓約 1MB），而牆上只需要
  // w320。降階不會有代價——瀏覽器不會為變小的 sizes 重抓已載好的圖，只有新
  // 掛載的照片會用到這個值，那正是我們要修的對象。升階則維持防抖，免得放大
  // 過程中每跨一階就觸發一輪重抓。
  const [sizesPx, setSizesPx] = useState(() => snapSizes(minScale, ladder))
  const sizesUpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useMotionValueEvent(pz.scale, 'change', (s) => {
    const next = snapSizes(s, ladder)
    if (sizesUpTimer.current) clearTimeout(sizesUpTimer.current)
    setSizesPx((cur) => (next < cur ? next : cur))
    sizesUpTimer.current = setTimeout(
      () => setSizesPx(next),
      SIZES_UPGRADE_DELAY_MS,
    )
  })
  useEffect(
    () => () => {
      if (sizesUpTimer.current) clearTimeout(sizesUpTimer.current)
    },
    [],
  )

  // 遠景 LOD：照片縮到這個級別以下時，資訊卡的字已經小到讀不出來，
  // 只剩下昂貴的文字光柵化。收起來換成年份大字當導航錨點。
  const [farLod, setFarLod] = useState(false)
  useMotionValueEvent(pz.scale, 'change', (s) => setFarLod(s < CARD_LOD_SCALE))

  const [visibleCells, setVisibleCells] = useState<WallCell[]>(layout.cells)
  const visibleRafRef = useRef<number | null>(null)

  const commitVisibleCells = (next: WallCell[]) => {
    setVisibleCells((current) => (sameCells(current, next) ? current : next))
  }

  const updateVisibleCells = () => {
    const next = visibleCellsForViewport(
      layout.cells,
      viewport,
      getTransform(),
      fm.focusedSlug,
    )
    commitVisibleCells(next)
  }

  const scheduleVisibleCellsUpdate = () => {
    if (visibleRafRef.current !== null) return
    visibleRafRef.current = requestAnimationFrame(() => {
      visibleRafRef.current = null
      updateVisibleCells()
    })
  }

  useEffect(() => {
    if (visibleRafRef.current !== null) {
      cancelAnimationFrame(visibleRafRef.current)
    }
    visibleRafRef.current = requestAnimationFrame(() => {
      visibleRafRef.current = null
      const next = visibleCellsForViewport(
        layout.cells,
        viewport,
        getTransform(),
        fm.focusedSlug,
      )
      commitVisibleCells(next)
    })
  }, [layout.cells, viewport, getTransform, fm.focusedSlug])

  useEffect(
    () => () => {
      if (visibleRafRef.current !== null) {
        cancelAnimationFrame(visibleRafRef.current)
      }
    },
    [],
  )

  useMotionValueEvent(pz.x, 'change', scheduleVisibleCellsUpdate)
  useMotionValueEvent(pz.y, 'change', scheduleVisibleCellsUpdate)
  useMotionValueEvent(pz.scale, 'change', scheduleVisibleCellsUpdate)

  const yearOpacity = useTransform(pz.scale, (s) => yearMarkerOpacity(s))

  // 控制列淡出的基準：聚焦照片（含資訊卡）fit 進視窗所需的 scale
  const focusFitScale = focusedCell ? fm.fitScaleOf(focusedCell) : 1

  // 縮到最小倍率（牆高滿版）。錨在視窗中心而不是把整面牆置中——橫向已經看不完，
  // 縮小的同時還把人丟到牆的正中間只會失去方位感。
  const handleFitWall = useCallback(() => {
    if (viewport.width === 0) return
    zoomAtPoint(
      minScale,
      { x: viewport.width / 2, y: viewport.height / 2 },
      true,
    )
  }, [zoomAtPoint, minScale, viewport])

  // 前言面板的「瀏覽作品」按鈕：手機螢幕窄，面板常撐滿視窗看不出右邊還有牆，
  // 直接把鏡頭帶到最新照片（第一欄第一張）的左上角。對齊的是年份大字的頂端
  // （而不是照片頂端）並多留一點留白，避免年份標題被浮動 header 蓋住、
  // 也讓照片跟視窗左緣有比初始鏡頭更寬鬆的呼吸空間。順便把鏡頭縮小到剛好
  // 露出第二欄一角，讓使用者一眼看出右邊還有更多照片可以捲。
  const handleViewPhotos = useCallback(() => {
    if (viewport.width === 0) return
    const first = layout.cells[0]
    if (!first) return
    const extra = cssPx('--space-4', 16)
    const marginX = cssPx('--page-gutter', 48) + extra
    const marginY = headerClearance() + extra
    // 桌機螢幕本來就寬，光是定位過去就看得到旁邊的照片，不必額外縮小；
    // 縮放只在手機上做，用來彌補螢幕窄、擠不出第二欄的問題。
    const s = isDesktop
      ? getTransform().scale
      : Math.min(
          maxScale,
          Math.max(
            minScale,
            (viewport.width - marginX) / (COL_W + GAP_X + VIEW_PHOTOS_PEEK_PX)
          )
        )
    animateTo({
      x: marginX - first.x * s,
      y: marginY - layout.yearMarkerY * s,
      scale: s,
    })
  }, [
    viewport.width,
    layout.cells,
    layout.yearMarkerY,
    minScale,
    maxScale,
    isDesktop,
    getTransform,
    animateTo,
  ])

  // 焦點救援：虛擬化會把「目前有 DOM 焦點的那張照片」連同它的 <a> 一起卸載。
  // 聚焦時用方向鍵翻個兩三張，最初點進來的那張就滑出可視範圍被移除，焦點掉回
  // <body>，之後 keydown 再也到不了這個 viewport——方向鍵就此失效（點一下畫面上
  // 的上／下一張按鈕又會好，因為焦點回到 viewport 裡了）。每次重掛後撿回來。
  const hadFocus = useRef(false)
  useEffect(() => {
    const node = viewportRef.current
    if (!node || !hadFocus.current) return
    if (document.activeElement === document.body) {
      node.focus({ preventScroll: true })
    }
  }, [visibleCells, fm.focusedSlug])

  const handleBlurCapture = useCallback((e: React.FocusEvent) => {
    // relatedTarget 是 null 多半代表「元素被移除」，那正是要救援的情況，別清旗標
    const next = e.relatedTarget as Node | null
    if (next && !viewportRef.current?.contains(next)) hadFocus.current = false
  }, [])

  // Tab 到某張照片時把鏡頭帶過去，否則焦點會落在螢幕外（違反 WCAG 2.4.11）
  const handleFocusCapture = useCallback(
    (e: React.FocusEvent) => {
      hadFocus.current = true
      if (fm.focusedSlug) return
      const el = e.target as HTMLElement
      const id = el.dataset?.photoId
      if (!id) return
      // 只有鍵盤 Tab 進來才帶鏡頭。滑鼠點擊也會觸發 focus，那時鏡頭馬上要交給
      // activate／focusOn 接手；這裡先動一下的話，activate 記下的 preFocus 就是
      // 動到一半的位置，退出 focus 時回不到原本的牆面。
      if (!el.matches?.(':focus-visible')) return
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
    [fm.focusedSlug, layout.cells, pz, animateTo, viewport],
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
    [fm, zoomBy, handleFitWall, panByScreen, viewport],
  )

  return (
    <div
      ref={setViewportNode}
      className={`${styles.viewport} ${
        isInteracting ? styles.isInteracting : ''
      }`}
      tabIndex={0}
      role="application"
      aria-roledescription={locale === 'en' ? 'Photo wall' : '照片牆'}
      onPointerDown={pz.onPointerDown}
      onPointerMove={pz.onPointerMove}
      onPointerUp={pz.onPointerUp}
      onPointerCancel={pz.onPointerCancel}
      onClickCapture={pz.onClickCapture}
      onKeyDown={handleKeyDown}
      onFocusCapture={handleFocusCapture}
      onBlurCapture={handleBlurCapture}
    >
      <motion.div
        className={`${styles.wall} ${farLod ? styles.isFarLod : ''}`}
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
          onViewPhotos={handleViewPhotos}
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

        {visibleCells.map((cell) => (
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
