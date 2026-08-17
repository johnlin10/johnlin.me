import type { Photo, PhotoExif } from '@/app/types/photo'
import type { SupportedLocale } from '@/app/types/blog'
import { spaceCJK } from '@/app/lib/text/spacing'

//* ==================== 照片顯示格式化 ====================
// 前台單張頁、列表、牆上卡片、燈箱共用的顯示邏輯，單一事實來源。

const INTL_LOCALE: Record<SupportedLocale, string> = {
  'zh-tw': 'zh-TW',
  en: 'en-US',
}

/** locale 欄位取值，缺當前語系就退回 zh-tw。 */
function localeField(
  photo: Photo,
  locale: SupportedLocale,
  key: 'caption' | 'locationName'
): string | undefined {
  const current = photo.locales[locale]?.[key]
  if (current) return current
  return photo.locales['zh-tw']?.[key]
}

export function photoCaption(
  photo: Photo,
  locale: SupportedLocale
): string | undefined {
  return localeField(photo, locale, 'caption')
}

export function photoLocationName(
  photo: Photo,
  locale: SupportedLocale
): string | undefined {
  return localeField(photo, locale, 'locationName')
}

/**
 * 拍攝日期，依精度顯示到年 / 月 / 日。
 *
 * taken_at_local 已是拍攝當地的牆鐘時間（無時區），所以直接從字串取部件、
 * 用 Date.UTC 組一個「數值正確」的日期再以 UTC 格式化 —— 絕不能套 timeZone
 * 轉換，否則會平白位移一天（這正是 blog 那條時區慣例要處理的相反情境：
 * 那邊存 UTC 要轉台北，這邊存的就是當地時間，轉了反而錯）。
 *
 * omitCurrentYear：List 視圖的密集清單裡，今年的照片不必每張都印年份
 * （看的當下就知道是今年）。只在精度為 month／day 時省略——精度是 year
 * 的話年份本身就是唯一資訊，省了就什麼都不剩。
 */
export function formatTakenAt(
  takenAtLocal: string,
  precision: Photo['takenAtPrecision'],
  locale: SupportedLocale,
  options?: { omitCurrentYear?: boolean }
): string {
  const year = Number.parseInt(takenAtLocal.slice(0, 4), 10)
  const month = Number.parseInt(takenAtLocal.slice(5, 7), 10)
  const day = Number.parseInt(takenAtLocal.slice(8, 10), 10)
  if (!Number.isFinite(year)) return ''

  if (precision === 'year') {
    return locale === 'zh-tw' ? spaceCJK(`${year} 年`) : String(year)
  }

  const omitYear = !!options?.omitCurrentYear && year === new Date().getFullYear()
  const date = new Date(Date.UTC(year, month - 1, day))
  const fmtOptions: Intl.DateTimeFormatOptions = omitYear
    ? precision === 'month'
      ? { timeZone: 'UTC', month: 'long' }
      : { timeZone: 'UTC', month: 'long', day: 'numeric' }
    : precision === 'month'
      ? { timeZone: 'UTC', year: 'numeric', month: 'long' }
      : { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }
  const formatted = new Intl.DateTimeFormat(
    INTL_LOCALE[locale] ?? 'zh-TW',
    fmtOptions
  ).format(date)
  return locale === 'zh-tw' ? spaceCJK(formatted) : formatted
}

/** 去掉數字尾端多餘的 0（f/1.80 → f/1.8，6.90 → 6.9）。 */
function trimNumber(n: number): string {
  return Number.parseFloat(n.toFixed(2)).toString()
}

/** 快門：>= 1 秒直接秒數，否則轉成 1/x 分數（0.008 → 1/125s）。 */
function formatShutter(exposureTime: number): string {
  if (exposureTime >= 1) return `${trimNumber(exposureTime)}s`
  return `1/${Math.round(1 / exposureTime)}s`
}

/**
 * 焦距顯示值。可換鏡機身印實體焦距 —— 攝影師要能跟鏡頭銘牌對得上，
 * 70-300 的鏡頭卻標 405mm 會被當成顯示錯誤。小片幅反過來只有等效值有意義，
 * iPhone 主鏡頭的 6.765mm 看起來像超廣角。
 *
 * 以裁切係數 2.7 分界：全片幅 1.0、APS-C 1.5／1.6、M4/3 2.0 都在線下，
 * 手機約 3.5 在線上。缺哪一個就用另一個。
 */
function focalLengthValue(exif: PhotoExif): number | undefined {
  const { focalLength, focalLength35 } = exif
  if (focalLength === undefined) return focalLength35
  if (focalLength35 === undefined) return focalLength
  // ponytail: 固定門檻，1 吋隨身機（2.7x）剛好踩線；要更準就得存感光元件尺寸
  return focalLength35 / focalLength > 2.7 ? focalLength35 : focalLength
}

export interface ExifItem {
  /** i18n key 後綴，對應 GalleryPage.exif.<key> 的無障礙標籤 */
  key: 'aperture' | 'shutter' | 'iso' | 'focalLength' | 'camera' | 'lens'
  value: string
}

/**
 * 把 EXIF 攤成一組可顯示的項目（相機參數卡）。缺的欄位直接省略。
 * 相機以 model 為主（多數 model 字串已含廠牌）；廠牌另存但顯示端可不用。
 */
export function formatExifItems(exif: PhotoExif | undefined): ExifItem[] {
  if (!exif) return []
  const items: ExifItem[] = []
  if (exif.model) items.push({ key: 'camera', value: exif.model })
  if (exif.lens) items.push({ key: 'lens', value: exif.lens })
  const focal = focalLengthValue(exif)
  if (focal !== undefined) {
    items.push({ key: 'focalLength', value: `${trimNumber(focal)}mm` })
  }
  if (exif.fNumber !== undefined) {
    items.push({ key: 'aperture', value: `f/${trimNumber(exif.fNumber)}` })
  }
  if (exif.exposureTime !== undefined) {
    items.push({ key: 'shutter', value: formatShutter(exif.exposureTime) })
  }
  if (exif.iso !== undefined) {
    items.push({ key: 'iso', value: `ISO ${exif.iso}` })
  }
  return items
}

/**
 * 圖片 alt 文字。優先用 caption；沒有就用「地點 · 日期」組一個描述性替代文字，
 * 兩者都缺才退回純日期，避免空 alt。
 */
export function photoAltText(photo: Photo, locale: SupportedLocale): string {
  const caption = photoCaption(photo, locale)
  if (caption) return caption
  const location = photoLocationName(photo, locale)
  const date = formatTakenAt(photo.takenAtLocal, photo.takenAtPrecision, locale)
  if (location) return locale === 'zh-tw' ? `${location}，${date}` : `${location}, ${date}`
  return date
}
