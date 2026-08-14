//* ==================== 攝影牆座標變換 ====================
// 牆用 transform: translate(t.x, t.y) scale(s)，transform-origin 0 0。
// 牆座標點 (wx, wy) → 螢幕點：sx = t.x + wx*s，sy = t.y + wy*s。
// 這裡全是純函式，吃 viewport 尺寸當參數（不讓 viewport 洩漏進 layout.ts）。

export interface Transform {
  x: number
  y: number
  scale: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Size {
  width: number
  height: number
}

/**
 * 讓整面牆置中塞進 viewport 的 transform。padding 是左右／下方留白比例。
 * topInset 是螢幕像素，用來保留浮動 header 的淨空——不能只用對稱留白，
 * 否則牆頂通常比底部更早貼近視窗頂端，看起來擠在 header 下面。
 * 有 topInset 時垂直方向不置中，改成「頂端至少留 topInset」，多餘空間留在下方。
 */
export function fitWallTransform(
  wall: Size,
  viewport: Size,
  padding = 0.04,
  topInset = 0
): Transform {
  const vw = viewport.width * (1 - padding * 2)
  const vh = Math.max(1, viewport.height - topInset - viewport.height * padding)
  const scale = Math.min(vw / wall.width, vh / wall.height)
  return {
    scale,
    x: viewport.width / 2 - (wall.width / 2) * scale,
    y: topInset + (vh - wall.height * scale) / 2,
  }
}

/**
 * 讓某個牆座標矩形（通常是一張照片）置中塞進 viewport 的 transform。
 * padding 讓照片不貼齊視窗邊緣；照片不會超出視窗（取 min）。
 */
export function fitTransform(
  rect: Rect,
  viewport: Size,
  padding = 0.06
): Transform {
  const vw = viewport.width * (1 - padding * 2)
  const vh = viewport.height * (1 - padding * 2)
  const scale = Math.min(vw / rect.w, vh / rect.h)
  return centerTransform(rect, scale, viewport)
}

/** 在給定 scale 下，把 rect 的中心對齊 viewport 中心。 */
export function centerTransform(
  rect: Rect,
  scale: number,
  viewport: Size
): Transform {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  return {
    scale,
    x: viewport.width / 2 - cx * scale,
    y: viewport.height / 2 - cy * scale,
  }
}

/**
 * 以 anchor（螢幕座標）為錨點縮放：讓 anchor 底下的那一點在縮放前後不動。
 * 這是滑鼠滾輪縮放與雙指 pinch 的共同公式。
 */
export function anchorZoom(
  t: Transform,
  nextScale: number,
  anchor: { x: number; y: number }
): Transform {
  const ratio = nextScale / t.scale
  return {
    scale: nextScale,
    x: anchor.x - (anchor.x - t.x) * ratio,
    y: anchor.y - (anchor.y - t.y) * ratio,
  }
}

/** 把 scale 夾在 [min, max]。 */
export function clampScale(scale: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, scale))
}

/**
 * 牆可以拖出視窗邊緣、露出的留白，佔視窗長度的比例。
 * 給邊緣照片呼吸空間（不緊貼視窗邊），也是內容小於視窗時錨點縮放的「滑移餘裕」。
 */
export const EDGE_MARGIN_RATIO = 0.18

/**
 * 夾住平移。用統一的「邊界留白」模型取代「大於視窗夾邊、小於視窗強制置中」——
 * 後者會在內容小於視窗時把游標錨點縮放硬拉回內容中心（縮放不跟游標），
 * 也讓放大後的邊緣照片緊貼視窗、沒有留白。
 *
 * 允許內容原點落在 [min, max] 之間，兩端各留 margin 的視窗比例：
 * - 內容比視窗大：可平移看遍全牆，四周各多 margin 的留白（呼吸空間）。
 * - 內容比視窗小：range 反轉成一段 slack，內容可在其中滑動（錨點縮放才跟得上游標），
 *   而不會被硬釘在正中央。
 */
export function clampTranslate(
  t: Transform,
  wall: Size,
  viewport: Size
): Transform {
  return {
    scale: t.scale,
    x: clampAxis(t.x, wall.width * t.scale, viewport.width),
    y: clampAxis(t.y, wall.height * t.scale, viewport.height),
  }
}

function clampAxis(
  value: number,
  scaledContent: number,
  viewportLength: number
): number {
  const margin = viewportLength * EDGE_MARGIN_RATIO
  // a：內容左/上緣停在 +margin（內容被推到最右/下）
  // b：內容右/下緣停在 viewport-margin（內容被推到最左/上）
  const a = margin
  const b = viewportLength - scaledContent - margin
  return clamp(value, Math.min(a, b), Math.max(a, b))
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/**
 * 夾住平移，讓某個牆座標子矩形（focus 中的照片）維持覆蓋視窗。
 * 比整面牆的 clampTranslate 精準：放大後往旁邊拖時，中心照片不會漂到隔壁那張。
 * 矩形（在該 scale 下）比視窗大 → 邊緣不離開視窗內側；比視窗小 → 置中。
 */
export function clampTranslateToRect(
  t: Transform,
  rect: Rect,
  viewport: Size
): Transform {
  return {
    scale: t.scale,
    x: clampRectAxis(t.x, rect.x, rect.w, t.scale, viewport.width),
    y: clampRectAxis(t.y, rect.y, rect.h, t.scale, viewport.height),
  }
}

function clampRectAxis(
  value: number,
  rectStart: number,
  rectLength: number,
  scale: number,
  viewportLength: number
): number {
  const scaled = rectLength * scale
  if (scaled <= viewportLength) {
    // 矩形比視窗小 → 置中：screen 起點 = (viewport - scaled)/2
    return (viewportLength - scaled) / 2 - rectStart * scale
  }
  // 矩形比視窗大 → 起點 <= 0（不露左/上）、終點 >= viewport（不露右/下）
  const min = viewportLength - (rectStart + rectLength) * scale
  const max = -rectStart * scale
  return clamp(value, min, max)
}

/** 某個牆座標矩形 fit 進視窗所需的 scale（不平移，只算縮放）。 */
export function fitScaleForRect(
  rect: Rect,
  viewport: Size,
  padding = 0.06
): number {
  const vw = viewport.width * (1 - padding * 2)
  const vh = viewport.height * (1 - padding * 2)
  return Math.min(vw / rect.w, vh / rect.h)
}

/**
 * 目前視窗在牆座標下的可視矩形，含 margin 圈（以視窗尺寸為單位）緩衝。
 * 給解析度升級與 DOM 裁切用：反向把視窗四角變換回牆座標。
 */
export function visibleWallRect(
  t: Transform,
  viewport: Size,
  margin = 0.5
): Rect {
  const mx = viewport.width * margin
  const my = viewport.height * margin
  return {
    x: (-t.x - mx) / t.scale,
    y: (-t.y - my) / t.scale,
    w: (viewport.width + mx * 2) / t.scale,
    h: (viewport.height + my * 2) / t.scale,
  }
}

/** 兩個牆座標矩形是否相交（給可視裁切用）。 */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  )
}

/** 把一個牆座標矩形變換到螢幕座標（給量測、除錯用）。 */
export function wallRectToScreen(rect: Rect, t: Transform): Rect {
  return {
    x: t.x + rect.x * t.scale,
    y: t.y + rect.y * t.scale,
    w: rect.w * t.scale,
    h: rect.h * t.scale,
  }
}
