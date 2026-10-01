// 短文圖片與網址預覽封面的 webp。只跑在伺服器端（sharp 是 native 模組）。
import sharp from 'sharp'

/** 短文裡最大顯示 720×480，2x 螢幕 1440×960、手機燈箱 3x 約 1180 寬，1600 都夠。 */
export const NOTE_DISPLAY_EDGE = 1600
/** OG 圖的標準寬度，預覽卡大卡最寬 720，2x 剛好。 */
export const LINK_COVER_EDGE = 1200

const WEBP_QUALITY = 82
const WEBP_EFFORT = 4
const LIMIT_INPUT_PIXELS = 300_000_000

/**
 * 轉正、長邊縮到 maxEdge 以內（不放大）、轉 webp。
 * 回傳的 w/h 是轉正後的尺寸，前台拿來算比例。
 */
export async function toWebp(
  input: Buffer | Uint8Array,
  maxEdge: number
): Promise<{ body: Buffer; w: number; h: number }> {
  const { data, info } = await sharp(input, { limitInputPixels: LIMIT_INPUT_PIXELS })
    .rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT })
    .toBuffer({ resolveWithObject: true })
  return { body: data, w: info.width, h: info.height }
}
