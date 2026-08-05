// 封面主題色的 IO 層：抓圖、解碼、快取。實際的色彩運算在 tintFromPixels.ts。
// 只跑在伺服器端（sharp 是 native 模組，import 進 client bundle 會炸）。

import sharp from 'sharp'
import { unstable_cache } from 'next/cache'
import { tintFromPixels, type CoverTint } from '@/app/lib/images/tintFromPixels'

export type { CoverTint }

/** 取樣縮圖邊長。只是要顏色，24×24 就夠，再大只是浪費 CPU。 */
const SAMPLE_SIZE = 24
const FETCH_TIMEOUT_MS = 3000

async function extractCoverTint(url: string): Promise<CoverTint | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return null

    // 直接縮成正方形取樣：不用讀 metadata、不用算 extract 座標，
    // 任何長寬比都能用，縮圖的底部列就對應原圖的底部。fill 會變形但取色不在乎。
    const { data, info } = await sharp(Buffer.from(await res.arrayBuffer()))
      .rotate() // 依 EXIF 轉正，否則直式照片的「底部」會取到側邊
      .flatten({ background: '#ffffff' }) // 透明 PNG 疊白底，不然 alpha 區會算成黑
      .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    return tintFromPixels(data, info.width, info.height, info.channels)
  } catch (error) {
    // 取不到色不是錯誤情境，卡片會退回 --surface-2。
    console.warn('[coverTint] 萃取失敗:', url, error)
    return null
  }
}

/**
 * 取得封面圖的卡片主題色（含快取）。
 * 快取 key 帶 URL，換封面圖時 storage path 會變，自動失效。
 */
export function getCoverTint(url: string): Promise<CoverTint | null> {
  return unstable_cache(() => extractCoverTint(url), ['cover-tint', url], {
    revalidate: 60 * 60 * 24 * 30,
    tags: ['cover-tint'],
  })()
}
