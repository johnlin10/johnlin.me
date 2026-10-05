import { useCallback, useMemo, useRef, useState } from 'react'
import {
  centerTransform,
  FIT_PADDING,
  fitWallTransform,
  wallRectToScreen,
  type Rect,
  type Size,
} from '@/app/lib/photos/geometry'
import type { WallCell } from '@/app/lib/photos/wallLayout'
import type { SupportedLocale } from '@/app/types/blog'
import { useWallUrlSync } from './useWallUrlSync'
import type { usePanZoom } from './usePanZoom'

/** 聚焦資訊卡量到之前的高度估值（螢幕像素）。 */
const FOCUS_CARD_H_ESTIMATE = 140
/** 資訊卡再高，照片也至少保有 fit 區域這個比例的高度（矮視窗，例如手機橫拿）。 */
const MIN_PHOTO_SHARE = 0.5

/** 縮放到某張照片 r >= 此值就磁吸進 focus（限位器）。 */
const SNAP_IN = 0.85
/** 退出 focus 的 r 門檻：手勢結束時 r < 此值就退回牆面。稍微縮小就退出，不用縮很多。 */
const SNAP_OUT = 0.8
/** 候選照片至少要有這麼多比例落在視窗內，才可能被磁吸。 */
const CONTAINMENT = 0.85
/** r 高於此值時，Esc/雙擊先回到 fit（第一段）；否則直接退出（第二段）。 */
const ZOOMED_THRESHOLD = 1.05

type PanZoom = ReturnType<typeof usePanZoom>

/** 原檔一個像素對到螢幕一個 CSS 像素的倍率，聚焦時最多放大到這裡看細節。 */
function nativeScaleOf(cell: WallCell): number {
  return cell.photo.width / cell.w
}

interface FocusMachineOptions {
  pz: PanZoom
  cells: WallCell[]
  wall: Size
  viewport: Size
  /** 照片 fit 用的區域：視窗扣掉底部導覽列 */
  stage: Size
  locale: SupportedLocale
  reduceMotion: boolean
}

/**
 * 攝影牆的聚焦狀態機。focus 不是獨立的燈箱，而是「牆縮放到某張照片的 fit，
 * 疊上暗色背景」——縮放沿用 usePanZoom，只是把平移夾在該照片矩形內。
 * 以 slug 當狀態鍵，與網址一致。
 */
export function useFocusMachine({
  pz,
  cells,
  wall,
  viewport,
  stage,
  locale,
  reduceMotion,
}: FocusMachineOptions) {
  const [focusedSlug, setFocusedSlug] = useState<string | null>(null)
  // 鏡頭最近一次對準的 fit 倍率；聚焦資訊卡用它反向縮放，字級才固定在螢幕上
  const [focusScale, setFocusScale] = useState(1)
  // 聚焦資訊卡實測高度的呈現用副本（螢幕像素），同欄下方照片據此讓位
  const [focusCardHeight, setFocusCardHeight] = useState(FOCUS_CARD_H_ESTIMATE)
  const focusedRef = useRef<string | null>(null)
  focusedRef.current = focusedSlug

  // 進 focus 前的牆 transform，退出時動畫回這裡（跨換照片維持不變）
  const preFocus = useRef<ReturnType<PanZoom['getTransform']> | null>(null)

  // 聚焦資訊卡的實測高度（螢幕像素）。卡片反向縮放、字級固定在螢幕上，
  // fit 先扣掉它，剩下的空間給照片；內容高度隨照片而異，由呈現層量測後回報。
  const focusCardH = useRef(FOCUS_CARD_H_ESTIMATE)
  // 剛進 focus（或換照片）時，等資訊卡量測回來要重新對準一次 fit。
  const pendingRefit = useRef(false)

  const cellBySlug = useMemo(
    () => new Map(cells.map((c) => [c.photo.slug, c])),
    [cells]
  )

  /** 照片塞進「fit 區域扣掉資訊卡高度」後的倍率。 */
  const fitScaleOf = useCallback(
    (cell: WallCell) => {
      const vw = stage.width * (1 - FIT_PADDING * 2)
      const vh = stage.height * (1 - FIT_PADDING * 2)
      const room = Math.max(vh - focusCardH.current, vh * MIN_PHOTO_SHARE)
      return Math.max(1e-3, Math.min(vw / cell.w, room / cell.photoH))
    },
    [stage]
  )
  // 聚焦框＝照片＋下方資訊卡（卡片在牆座標的高度是螢幕高度除以 fit 倍率）
  const rectOf = useCallback(
    (cell: WallCell): Rect => ({
      x: cell.x,
      y: cell.y,
      w: cell.w,
      h: cell.photoH + focusCardH.current / fitScaleOf(cell),
    }),
    [fitScaleOf]
  )
  const fitOf = useCallback(
    (cell: WallCell) => centerTransform(rectOf(cell), fitScaleOf(cell), stage),
    [rectOf, fitScaleOf, stage]
  )

  /** 對準某張照片（設 clamp、動畫到 fit、更新 focusedSlug）。 */
  const focusOn = useCallback(
    (cell: WallCell) => {
      // 資訊卡高度要等該照片的卡片掛載後才量得到；先用目前的估值動畫過去，
      // 卡片一回報就用 spring 平滑重定目標（見 reportFocusCardHeight）。
      pendingRefit.current = true
      pz.setClampRect(rectOf(cell), nativeScaleOf(cell), fitScaleOf(cell))
      pz.animateTo(fitOf(cell), {
        instant: reduceMotion,
      })
      setFocusScale(fitScaleOf(cell))
      setFocusedSlug(cell.photo.slug)
    },
    [pz, rectOf, fitOf, fitScaleOf, reduceMotion]
  )

  /**
   * 呈現層回報聚焦資訊卡的實測高度（螢幕像素；offsetHeight 不含 transform）。
   * 剛進 focus 時無條件校正 fit；之後只有「使用者仍在 fit 附近、未放大看細節」時才校正
   * （避免在使用者放大檢視時被拉回）。retarget 走 spring，過程連貫不跳。
   */
  const reportFocusCardHeight = useCallback(
    (h: number) => {
      if (!Number.isFinite(h) || h <= 0) return
      if (Math.abs(h - focusCardH.current) >= 1) {
        focusCardH.current = h
        setFocusCardHeight(h)
      }
      // 只在剛進 focus（pendingRefit）時用實測高度校正一次 fit；
      // 之後不再因量測回報而重對焦，避免與使用者的縮放（含 +/- 按鈕）互相拉扯。
      if (!pendingRefit.current) return
      const cur = focusedRef.current
      if (!cur) return
      const cell = cellBySlug.get(cur)
      if (!cell) return
      pendingRefit.current = false
      pz.setClampRect(rectOf(cell), nativeScaleOf(cell), fitScaleOf(cell))
      pz.animateTo(fitOf(cell), {
        instant: reduceMotion,
      })
      setFocusScale(fitScaleOf(cell))
    },
    [cellBySlug, pz, rectOf, fitOf, fitScaleOf, reduceMotion]
  )

  /**
   * 退出 focus：動畫回進 focus 前的牆位置。
   * pop=true 代表由 popstate 觸發，不再回退歷史。
   * keepView=true 給「縮小到門檻以下」那條路徑用——使用者已經自己縮到定位了，
   * 這時再動畫回 preFocus 會把他拉回更大的倍率，跟他剛做的動作相反。
   */
  const exit = useCallback(
    (pop: boolean, keepView = false) => {
      const cur = focusedRef.current
      if (!cur) return
      const cell = cellBySlug.get(cur)
      // preFocus 缺席（例如用瀏覽器「下一頁」直接前進到某張）時，退到這張照片
      // 周邊的牆面，比把整面牆塞進視窗合理——至少還看得出剛才在哪裡。
      const fallback = cell
        ? centerTransform(rectOf(cell), fitScaleOf(cell) * 0.5, viewport)
        : fitWallTransform(wall, viewport)
      const target = keepView
        ? pz.getTransform()
        : preFocus.current ?? fallback
      pz.setClampRect(null)
      pz.animateTo(target, { instant: reduceMotion, clampToWall: true })
      preFocus.current = null
      setFocusedSlug(null)
      if (!pop) window.history.back()
    },
    [pz, wall, viewport, reduceMotion, cellBySlug, fitScaleOf, rectOf]
  )

  // 網址同步：瀏覽器上一頁／下一頁改變 URL 時，把 focus 拉回一致
  const url = useWallUrlSync(locale, (slug) => {
    if (slug === focusedRef.current) return
    if (slug === null) {
      exit(true)
      return
    }
    const cell = cellBySlug.get(slug)
    if (cell) focusOn(cell) // 前進到某張（不再 push）
  })

  /** 點照片：記住當前牆位置、進 focus、推一筆歷史。 */
  const activate = useCallback(
    (cell: WallCell) => {
      // 已經在 focus 中還點到旁邊露出一角的另一張＝換照片，不是再進一層：
      // 沿用同一筆歷史（與方向鍵的 navigate 一致）。否則每點一張就多推一筆，
      // 退出時的 history.back() 只會退到上一張、把這次退出吃掉，preFocus 也
      // 在那一刻被清空，下一次退出就找不到原本的牆位置了。
      if (focusedRef.current) {
        focusOn(cell)
        url.replaceFocus(cell.photo.slug)
        return
      }
      preFocus.current = pz.getTransform()
      focusOn(cell)
      url.pushFocus(cell.photo.slug)
    },
    [pz, focusOn, url]
  )

  /** focus 中換照片（方向鍵）：連貫動畫、replaceState、preFocus 不動。 */
  const navigate = useCallback(
    (delta: number) => {
      const cur = focusedRef.current
      if (!cur) return
      const idx = cells.findIndex((c) => c.photo.slug === cur)
      const next = cells[idx + delta]
      if (!next) return
      focusOn(next)
      url.replaceFocus(next.photo.slug)
    },
    [cells, focusOn, url]
  )

  /** Esc / 雙擊 / 點背景：兩段式 —— 放大中先回 fit，fit 時才退出。 */
  const stepBack = useCallback(() => {
    const cur = focusedRef.current
    if (!cur) return
    const cell = cellBySlug.get(cur)
    if (!cell) return
    const r = pz.getTransform().scale / fitScaleOf(cell)
    if (r > ZOOMED_THRESHOLD) {
      pz.animateTo(fitOf(cell), {
        instant: reduceMotion,
      })
    } else {
      exit(false)
    }
  }, [cellBySlug, pz, fitScaleOf, fitOf, reduceMotion, exit])

  // 只在「放大」手勢後才評估磁吸進場；記住上次沉降的 scale 判斷是否放大
  const lastSettled = useRef(0)

  /** 視窗中覆蓋率達標、佔比最大的照片（磁吸候選）。 */
  const pickCandidate = useCallback((): WallCell | null => {
    const t = pz.getTransform()
    const vw = viewport.width
    const vh = viewport.height
    let best: WallCell | null = null
    let bestShare = 0
    for (const cell of cells) {
      const s = wallRectToScreen(
        { x: cell.x, y: cell.y, w: cell.w, h: cell.photoH },
        t
      )
      const ix = Math.max(0, Math.min(s.x + s.w, vw) - Math.max(s.x, 0))
      const iy = Math.max(0, Math.min(s.y + s.h, vh) - Math.max(s.y, 0))
      const inter = ix * iy
      if (inter <= 0) continue
      const containment = inter / (s.w * s.h)
      if (containment < CONTAINMENT) continue
      const share = inter / (vw * vh)
      if (share > bestShare) {
        bestShare = share
        best = cell
      }
    }
    return best
  }, [cells, pz, viewport])

  /**
   * 縮放手勢結束後評估限位器：
   * - focus 中且已縮到 r < SNAP_OUT → 連貫退出。
   * - 未 focus、且這次是放大、reduce motion 未開 → 若對準某張照片 r >= SNAP_IN，磁吸進 focus。
   */
  const onZoomSettled = useCallback(() => {
    const s = pz.getTransform().scale
    const zoomedIn = s > lastSettled.current + 0.001
    lastSettled.current = s

    const cur = focusedRef.current
    if (cur) {
      const cell = cellBySlug.get(cur)
      if (cell && s / fitScaleOf(cell) < SNAP_OUT) exit(false, true)
      return
    }

    if (reduceMotion || !zoomedIn) return
    const candidate = pickCandidate()
    if (!candidate) return
    if (s / fitScaleOf(candidate) >= SNAP_IN) activate(candidate)
  }, [
    pz,
    cellBySlug,
    fitScaleOf,
    exit,
    reduceMotion,
    pickCandidate,
    activate,
  ])

  return {
    focusedSlug,
    focusScale,
    focusCardHeight,
    activate,
    navigate,
    stepBack,
    exit,
    onZoomSettled,
    reportFocusCardHeight,
    fitScaleOf,
    cellBySlug,
  }
}
