// 文章圖片的四級 webp。只跑在伺服器端（sharp 是 native 模組）。
import sharp from 'sharp'

/** 卡片 400px、正文 720px、有目錄的封面 1080px，乘上 2–3 倍螢幕密度。 */
export const POST_IMAGE_LADDER = [480, 960, 1440, 2160] as const

const WEBP_QUALITY = 82
const WEBP_EFFORT = 4
const LIMIT_INPUT_PIXELS = 300_000_000

/**
 * 轉正後依寬度產生各級 webp，不放大：原圖比某一級窄就不產那一級，
 * 連最小一級都不到就只產一張原始寬度。
 * @param input 原檔
 * @returns 由小到大的各級，w 是實際寬度
 */
export async function derivePostImage(
  input: Buffer | Uint8Array
): Promise<{ w: number; body: Buffer }[]> {
  const meta = await sharp(input, { limitInputPixels: LIMIT_INPUT_PIXELS }).metadata()
  if (!meta.width || !meta.height) throw new Error('讀不出影像尺寸')
  // EXIF orientation 5–8 是轉了 90 度，轉正後寬高對調
  const width = (meta.orientation ?? 1) >= 5 ? meta.height : meta.width

  const widths: number[] = POST_IMAGE_LADDER.filter((w) => w <= width)
  if (widths.length === 0) widths.push(width)

  const steps: { w: number; body: Buffer }[] = []
  for (const w of widths) {
    const body = await sharp(input, { limitInputPixels: LIMIT_INPUT_PIXELS })
      .rotate()
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT })
      .toBuffer()
    steps.push({ w, body })
  }
  return steps
}
