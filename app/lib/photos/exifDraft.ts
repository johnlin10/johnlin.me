import exifr from 'exifr'
import type { PhotoExif, PhotoLocation, PhotoTakenAtPrecision } from '@/app/types/photo'

//* ==================== 瀏覽器端 EXIF 預檢 ====================
// 上傳預檢表的資料來源。純粹讀取與整形，不碰網路、不寫入任何東西 ——
// 使用者確認過欄位之後才會真的送出。

/** 完全沒有拍攝時間可用時的退回時區。只影響排序，不影響顯示。 */
export const PHOTO_FALLBACK_TZ_OFFSET = '+08:00'

export interface ExifDraft {
  /** 'YYYY-MM-DDTHH:mm:ss'，缺日期時未定義，交給使用者手填。 */
  takenAtLocal?: string
  /** '+08:00' 這種格式，來自 OffsetTimeOriginal；沒有就 undefined。 */
  tzOffset?: string
  exif?: PhotoExif
  /** 完整精度，還沒四捨五入 —— 四捨五入只在使用者勾選公開時才做，見 upload 頁。 */
  gps?: PhotoLocation
  isHdr: boolean
}

// exifr 前 4MB 夠涵蓋 metadata 區塊，不需要整個檔案就能找到 HDR 標記。
const HDR_SCAN_BYTES = 4 * 1024 * 1024
const HDR_MARKERS = ['hdrgm', 'urn:iso:std:iso:ts:21496', 'HDRGainMap']

function parseRawDateTime(raw: string | undefined): string | undefined {
  // EXIF 的日期是 'YYYY:MM:DD HH:mm:ss'，冒號要換成連字號、空格換成 T。
  // 絕不能用 exifr 預設 revive 出來的 Date：那是用瀏覽器目前時區組出來的，
  // 同一個檔案在不同時區的機器上開會讀到不同的牆鐘時間，實測差到 8 小時。
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw ?? '')
  if (!match) return undefined
  const [, y, mo, d, h, mi, s] = match
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`
}

function pickExif(raw: Record<string, unknown>): PhotoExif | undefined {
  const exif: PhotoExif = {}
  if (typeof raw.Make === 'string') exif.make = raw.Make
  if (typeof raw.Model === 'string') exif.model = raw.Model
  if (typeof raw.LensModel === 'string') exif.lens = raw.LensModel
  if (typeof raw.FNumber === 'number') exif.fNumber = raw.FNumber
  if (typeof raw.ExposureTime === 'number') exif.exposureTime = raw.ExposureTime
  if (typeof raw.ISO === 'number') exif.iso = raw.ISO
  if (typeof raw.FocalLength === 'number') exif.focalLength = raw.FocalLength
  return Object.keys(exif).length > 0 ? exif : undefined
}

async function detectHdr(file: File): Promise<boolean> {
  const head = await file.slice(0, HDR_SCAN_BYTES).text()
  return HDR_MARKERS.some((marker) => head.includes(marker))
}

/**
 * 讀取一個檔案的 EXIF 預檢資料。
 *
 * reviveValues: false 是唯一安全的讀法 —— exifr 預設會把 DateTimeOriginal
 * revive 成瀏覽器目前時區的 Date，實測同一個檔案在 UTC 與 +08:00 的機器上
 * 讀出來差 8 小時。GPS 因為 raw 模式下只回傳角分秒的原始陣列，改用
 * exifr.gps() 另外拿一次十進位座標。
 *
 * 讀不到日期不當錯誤：使用者在預檢表手填即可，這裡只回傳 undefined。
 */
export async function readExifDraft(file: File): Promise<ExifDraft> {
  const [raw, gps, isHdr] = await Promise.all([
    exifr
      // ifd0（含 Make/Model）依 exifr 的型別定義本來就無法關閉，不用列出來。
      .parse(file, { reviveValues: false, tiff: true, exif: true, gps: true })
      .catch(() => null),
    exifr.gps(file).catch(() => null),
    detectHdr(file),
  ])

  if (!raw) return { isHdr }

  const takenAtLocal =
    parseRawDateTime(raw.DateTimeOriginal as string | undefined) ??
    parseRawDateTime(raw.CreateDate as string | undefined) ??
    parseRawDateTime(raw.ModifyDate as string | undefined)

  return {
    takenAtLocal,
    tzOffset: typeof raw.OffsetTimeOriginal === 'string' ? raw.OffsetTimeOriginal : undefined,
    exif: pickExif(raw),
    gps: gps ? { lat: gps.latitude, lng: gps.longitude } : undefined,
    isHdr,
  }
}

/** 拿檔案的最後修改時間當退回值，午間 12:00 不會被任何合理時區誤差推過日界線。 */
export function fallbackTakenAtLocal(file: File): string {
  const d = new Date(file.lastModified)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T12:00:00`
}

/** 依精度把 takenAtLocal 正規化成 DB 要求的完整時間戳字串。 */
export function normalizeTakenAtLocal(
  value: string,
  precision: PhotoTakenAtPrecision
): string {
  const year = value.slice(0, 4)
  if (precision === 'year') return `${year}-01-01T12:00:00`
  if (precision === 'month') return `${value.slice(0, 7)}-01T12:00:00`
  return value
}

/** taken_at_local ＋ 時區位移 → taken_at（DB 存 timestamptz 要用的絕對時間）。 */
export function toTakenAt(takenAtLocal: string, tzOffset?: string): string {
  return `${takenAtLocal}${tzOffset ?? PHOTO_FALLBACK_TZ_OFFSET}`
}
