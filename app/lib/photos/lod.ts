import { COL_W } from './wallLayout'

//* ==================== 攝影牆的細節分級（LOD）====================
// 牆是單一 transform，next/image 的 sizes 沒辦法隨縮放自動調，這裡自己算。

/**
 * 依「照片在螢幕上實際佔的裝置像素寬」挑一個 srcSet 目標寬度。
 * 目標寬度 = COL_W × scale × DPR，取第一個 ≥ 它的 tier。
 */
export function tierFor(
  scale: number,
  devicePixelRatio: number,
  tiers: number[]
): number {
  if (tiers.length === 0) return 0
  const target = COL_W * scale * devicePixelRatio
  for (const t of tiers) {
    if (t >= target) return t
  }
  return tiers[tiers.length - 1]
}

/**
 * 年份大字的反向 LOD：縮小時顯示（當導航錨點），放大後淡出。
 * 回傳 0..1 的 opacity。
 */
export function yearMarkerOpacity(scale: number): number {
  if (scale >= 1.6) return 0
  if (scale <= 1.0) return 1
  // 1.0 → 1.6 線性淡出（瀏覽階段維持可見，只有真正貼近看照片時才收起）
  return (1.6 - scale) / 0.6
}
