// 攝影作品的衍生檔產生。只跑在伺服器端（sharp 是 native 模組，
// import 進 client bundle 會炸）——與 coverTint.ts 同一類。
import sharp from 'sharp'

//* ==================== SDR 衍生階梯 ====================

/**
 * 階梯的目標寬度。是「寬」不是長邊：srcSet 的 `${w}w` 描述子講的是檔案實際
 * 寬度，直幅照片若照長邊縮放，描述子就會說謊，瀏覽器會固定挑小一級的階。
 *
 * 上限 3200 是因為攝影牆的欄寬 320 乘以最大縮放與 DPR 之後就在這附近，
 * 再往上只是讓瀏覽期多載沒人看得出差別的位元組；真的要看細節時，
 * 前台聚焦會直接載原檔。
 */
export const DERIVATIVE_LADDER = [
  320, 640, 960, 1280, 1600, 2048, 2560, 3200,
] as const

const WEBP_QUALITY = 82
const WEBP_EFFORT = 4

const OG_WIDTH = 1200
const OG_HEIGHT = 630
const OG_QUALITY = 82

const BLUR_WIDTH = 20
const BLUR_QUALITY = 50
/** 超過就不存。這串會進到每一個 gallery 頁面的 HTML，實測正常值約 250 字元。 */
const MAX_BLUR_DATA_URL = 2000

/** 約 7425×5569 的樣本是 4100 萬像素，留很大的餘裕擋住惡意的解壓縮炸彈。 */
const LIMIT_INPUT_PIXELS = 300_000_000

export interface DerivedImage {
  width: number
  body: Buffer
}

export interface DerivedPhoto {
  /** 轉正之後的原圖尺寸，也就是要寫進 DB 的值 */
  width: number
  height: number
  derivatives: DerivedImage[]
  og: Buffer
  blurDataUrl?: string
}

/**
 * 從 EXIF 的 orientation 推出轉正後的尺寸。
 *
 * 這一步不能省：sharp 的 metadata() 回報的是「檔案裡怎麼存」的尺寸，
 * 即使加上 autoOrient 選項也一樣不換軸（實測 orientation=6 的 800×400
 * 仍回報 800×400，但實際輸出是 400×800）。而 width/height 是前台算版面
 * 比例的唯一依據，存錯的話直幅照片會被塞進橫幅的格子裡。
 *
 * 5–8 這四個值都含 90 度旋轉，所以換軸；1–4 只有翻轉與 180 度，不換。
 * 八個值都實測對過。
 */
function orientedSize(
  width: number,
  height: number,
  orientation: number | undefined
): { width: number; height: number } {
  const swap = orientation !== undefined && orientation >= 5
  return swap ? { width: height, height: width } : { width, height }
}

/**
 * 產生一張照片的全部衍生檔。
 *
 * 色彩：sharp 預設就會依嵌入的 ICC 把像素轉成 sRGB（實測 Display P3 的原檔
 * 轉出來與 withIccProfile('srgb') 完全一致，與 keepIccProfile 的 P3 原生值
 * 則最大差 42），所以這裡輸出不帶 ICC ——瀏覽器對無標籤的圖就是當 sRGB 解讀，
 * 結果正確，又省下每一階都要多帶的 548 bytes。
 *
 * 廣色域與 HDR 沒有因此消失：原檔一個位元組都不會被重新編碼，前台聚焦時
 * 載的就是它。階梯是拿來瀏覽的，原檔才是拿來看的。
 */
export async function derivePhoto(original: Buffer): Promise<DerivedPhoto> {
  const meta = await sharp(original, {
    limitInputPixels: LIMIT_INPUT_PIXELS,
  }).metadata()

  if (!meta.width || !meta.height) {
    throw new Error('讀不出影像尺寸')
  }
  const size = orientedSize(meta.width, meta.height, meta.orientation)

  // 不放大：原圖比某一階窄的話就不產那一階。若連最小階都不到，
  // 就只產一階原始寬度，否則這張照片會完全沒有 srcSet 可用。
  const widths: number[] = DERIVATIVE_LADDER.filter((w) => w <= size.width)
  if (widths.length === 0) widths.push(size.width)
  const topWidth = widths[widths.length - 1]

  // 先解一次碼、縮到最大階，之後每一階都從這份未壓縮的中間結果出發。
  // 每一階各自從原檔解碼的話，42 MB 的樣本實測要 3064ms；這樣是 1615ms。
  const base = await sharp(original, { limitInputPixels: LIMIT_INPUT_PIXELS })
    .rotate()
    .resize({ width: topWidth, withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true })

  // 交叉驗證換軸規則：中間結果的比例應該與推算出來的一致。
  // 不一致代表 orientation 判斷錯了，這時候寧可炸掉也不要寫進一組錯的尺寸。
  const expected = size.width / size.height
  const actual = base.info.width / base.info.height
  if (Math.abs(expected - actual) > 0.02) {
    throw new Error(
      `方向判讀不一致：預期比例 ${expected.toFixed(3)}，實際 ${actual.toFixed(3)}`
    )
  }

  const fromBase = () => sharp(base.data, { raw: base.info })

  const derivatives: DerivedImage[] = []
  for (const width of widths) {
    const body = await fromBase()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT })
      .toBuffer()
    derivatives.push({ width, body })
  }

  // OG 用 JPEG 不用 WebP：仍有社群平台的爬蟲讀不了 WebP 的預覽圖。
  const og = await fromBase()
    .resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover' })
    .jpeg({ quality: OG_QUALITY, mozjpeg: true })
    .toBuffer()

  const blur = await fromBase()
    .resize({ width: BLUR_WIDTH })
    .webp({ quality: BLUR_QUALITY })
    .toBuffer()
  const blurDataUrl = `data:image/webp;base64,${blur.toString('base64')}`

  return {
    width: size.width,
    height: size.height,
    derivatives,
    og,
    blurDataUrl:
      blurDataUrl.length <= MAX_BLUR_DATA_URL ? blurDataUrl : undefined,
  }
}
