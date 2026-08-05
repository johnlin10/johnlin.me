// ============================================================
// 從像素算出卡片主題色。純函式，不碰 IO / sharp / Next，方便單獨驗算。
//
// 核心原則：色相（H）跟彩度（C）來自圖片，明度（L）永遠由主題寫死（見
// PostCard.module.scss）。因為 L 不是從圖片來的，不管上傳什麼圖，文字對比度
// 都是固定的 —— 這是「任何圖片都不突兀、文字都清楚」的關鍵，不需要在 runtime
// 跑對比度檢查再回退。
// ============================================================

import { srgbToOklch, circularMeanHue } from '@/app/lib/color/oklch'

export interface CoverTint {
  hue: number
  chroma: number
}

/** 只看圖片底部這個比例 —— 漸層要跟圖片「下緣」接起來，取整張的平均色接縫會歪。 */
export const BOTTOM_RATIO = 0.3
/** 色相分箱數（每箱 30°）。 */
const HUE_BINS = 12
/** 低於這個彩度視為灰階像素，不參與色相投票。 */
const ACHROMATIC_THRESHOLD = 0.02
/** 有色像素少於這個比例就當成灰階圖。 */
const CHROMATIC_PIXEL_RATIO = 0.15
/** 灰階圖的退路：站上的陶土橘色相，讓黑白照也落在暖色調性裡，而不是死板的中性灰。 */
const FALLBACK_HUE = 52
const FALLBACK_CHROMA = 0.012
/** 彩度上限避免任何圖出現刺眼的色塊；下限保證看得出是從圖片來的。 */
const CHROMA_MIN = 0.008
const CHROMA_MAX = 0.055

const FALLBACK: CoverTint = { hue: FALLBACK_HUE, chroma: FALLBACK_CHROMA }

/**
 * 由 raw RGB 像素算出主題色。只取底部 BOTTOM_RATIO 的列。
 *
 * @param data 逐像素排列的 raw buffer
 * @param width / height 像素尺寸
 * @param channels 每像素位元組數（3 = RGB，4 = RGBA，alpha 會被忽略）
 */
export function tintFromPixels(
  data: Uint8Array | Buffer,
  width: number,
  height: number,
  channels: number
): CoverTint | null {
  const binSize = 360 / HUE_BINS
  const bins = Array.from({ length: HUE_BINS }, () => ({
    weight: 0,
    chromaSum: 0,
    count: 0,
    samples: [] as { hue: number; weight: number }[],
  }))

  let total = 0
  let chromatic = 0

  for (let y = Math.floor(height * (1 - BOTTOM_RATIO)); y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels
      const { c, h } = srgbToOklch(data[i], data[i + 1], data[i + 2])
      total++
      if (c < ACHROMATIC_THRESHOLD) continue

      chromatic++
      // 以彩度加權：鮮豔的像素更能代表這張圖給人的印象。
      const bin = bins[Math.min(Math.floor(h / binSize), HUE_BINS - 1)]
      bin.weight += c
      bin.chromaSum += c
      bin.count++
      bin.samples.push({ hue: h, weight: c })
    }
  }

  if (total === 0) return null
  if (chromatic / total < CHROMATIC_PIXEL_RATIO) return FALLBACK

  // 取票數最高的那一箱，而不是全部平均：整張圖直接平均會把互補色相消成一坨死灰。
  const winner = bins.reduce((best, bin) => (bin.weight > best.weight ? bin : best))
  if (winner.count === 0) return FALLBACK

  return {
    hue: Math.round(circularMeanHue(winner.samples) * 10) / 10,
    chroma:
      Math.round(
        Math.min(CHROMA_MAX, Math.max(CHROMA_MIN, winner.chromaSum / winner.count)) *
          10000
      ) / 10000,
  }
}
