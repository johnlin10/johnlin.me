// ============================================================
// sRGB → OKLab → OKLCH 轉換（Björn Ottosson 的標準矩陣）。
// 純函式、零相依，給封面主題色萃取用。
// 注意：app/utils/colorUtils.ts 是「讀 CSS 變數值」的工具，跟這裡無關，別混用。
// ============================================================

export interface Oklch {
  /** 感知明度 0–1 */
  l: number
  /** 彩度，sRGB 色域內大致落在 0–0.37 */
  c: number
  /** 色相角 0–360 */
  h: number
}

/** 8-bit sRGB 分量 → 線性光。色彩運算一定要先解掉 gamma，否則平均出來會偏暗。 */
function srgbToLinear(value: number): number {
  const s = value / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

/** 8-bit sRGB → OKLCH。 */
export function srgbToOklch(r: number, g: number, b: number): Oklch {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)

  const long = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const medium = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const short = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb

  const l_ = Math.cbrt(long)
  const m_ = Math.cbrt(medium)
  const s_ = Math.cbrt(short)

  const l = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_

  const c = Math.hypot(a, bb)
  let h = (Math.atan2(bb, a) * 180) / Math.PI
  if (h < 0) h += 360

  return { l, c, h }
}

/**
 * 色相的加權圓周平均。
 * 色相是角度不是純量，350° 和 10° 直接算術平均會得到 180°（完全相反的顏色），
 * 必須先轉成單位向量相加再取回角度。
 */
export function circularMeanHue(
  samples: { hue: number; weight: number }[]
): number {
  let sumSin = 0
  let sumCos = 0
  for (const { hue, weight } of samples) {
    const rad = (hue * Math.PI) / 180
    sumSin += Math.sin(rad) * weight
    sumCos += Math.cos(rad) * weight
  }
  let mean = (Math.atan2(sumSin, sumCos) * 180) / Math.PI
  if (mean < 0) mean += 360
  return mean
}
