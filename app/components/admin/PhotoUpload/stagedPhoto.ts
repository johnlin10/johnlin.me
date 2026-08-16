import type {
  PhotoExif,
  PhotoLocation,
  PhotoTakenAtPrecision,
} from '@/app/types/photo'
import { buildPhotoLocales } from '@/app/lib/photos/localeFields'

export type StageStatus =
  | 'reading' // exifr + readImageSize 進行中
  | 'ready' // 讀取成功。是否能實際送出還要看 hasExifDate 與 slug 是否合法 ——
  //           那兩項是逐列算的衍生狀態，不在這裡，見 upload/page.tsx 的 confirmable
  | 'invalid' // 檔案毀損或瀏覽器解不開（不是格式白名單擋掉的那種，那種在選檔階段就濾掉了）
  | 'uploading' // PUT 進行中，progress 有意義
  | 'processing' // PUT 完成、ingest 進行中（無法量進度）
  | 'done'
  | 'error'

export interface StagedPhoto {
  /** React key，跨編輯保持穩定；與 assetId 分開是因為早期還沒有 assetId 也要能渲染。 */
  localId: string
  /** crypto.randomUUID()，同時是 R2 物件前綴與最終的 photos.id。 */
  assetId: string
  file: File
  /** URL.createObjectURL()，移除或卸載時必須 revoke。 */
  previewUrl: string
  /** 轉正後的像素尺寸（來自 readImageSize，已套用 EXIF 方向）。 */
  width: number
  height: number
  status: StageStatus
  /** 0..1，只在 uploading 階段有意義。 */
  progress: number
  error?: string

  // ---- 預檢表可編輯欄位 ----
  slug: string
  takenAtLocal: string
  /** takenAtLocal 是否來自 EXIF；false 代表使用者需要手動確認/填寫日期。 */
  hasExifDate: boolean
  takenAtPrecision: PhotoTakenAtPrecision
  tzOffset?: string
  captionZh: string
  captionEn: string
  locationNameZh: string
  locationNameEn: string
  includeGps: boolean
  /** 完整精度；四捨五入只在送出時、且 includeGps 為 true 時才做。 */
  gps?: PhotoLocation
  exif?: PhotoExif
  isHdr: boolean
}

function roundCoord(value: number): number {
  return Math.round(value * 1000) / 1000
}

/** 送出前才做的收斂：GPS 四捨五入、日期依精度正規化。 */
export function toIngestPayload(photo: StagedPhoto, takenAtLocal: string, takenAt: string) {
  return {
    assetId: photo.assetId,
    slug: photo.slug,
    takenAt,
    takenAtLocal,
    takenAtPrecision: photo.takenAtPrecision,
    isHdr: photo.isHdr,
    exif: photo.exif ?? null,
    location:
      photo.includeGps && photo.gps
        ? { lat: roundCoord(photo.gps.lat), lng: roundCoord(photo.gps.lng) }
        : null,
    locales: buildPhotoLocales(photo),
  }
}
