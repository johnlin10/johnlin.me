//* ==================== 攝影 Photos 型別 ====================

/** SDR 衍生檔的一階。階數依原圖尺寸而定，不會有超過原圖長邊的階。 */
export interface PhotoDerivative {
  /** 長邊像素寬，對應 srcSet 的 `${w}w` */
  w: number
  url: string
}

export interface PhotoExif {
  make?: string
  model?: string
  lens?: string
  /** 光圈值，例如 1.8 */
  fNumber?: number
  /** 快門秒數，例如 0.008（= 1/125s）。顯示端負責轉成分數 */
  exposureTime?: number
  iso?: number
  /** 焦距（mm） */
  focalLength?: number
}

/** 只在管理員手動勾選時才寫入，且已四捨五入到小數 3 位（約 110m）。 */
export interface PhotoLocation {
  lat: number
  lng: number
}

/** 單一語系的可翻譯欄位。地名一律手填 —— EXIF 只有座標，沒有地名。 */
export interface PhotoLocaleFields {
  caption?: string
  locationName?: string
}

export type PhotoLocales = Record<string, PhotoLocaleFields>

/**
 * 拍攝時間的精確度。早期照片可能只記得年或月，
 * 顯示端據此決定要印到哪一層（2019 / 2019 年 6 月 / 2019 年 6 月 14 日）。
 */
export type PhotoTakenAtPrecision = 'day' | 'month' | 'year'

export type PhotoStatus = 'draft' | 'published'

export interface Photo {
  id: string
  slug: string

  /** 由小到大排序，供 srcSet 直接展開 */
  derivatives: PhotoDerivative[]
  /** 原檔原樣（HDR 保 HDR），聚焦時才載 */
  urlOriginal: string
  urlOg: string
  blurDataUrl?: string
  originalMime: string
  originalBytes: number

  /** 原始像素尺寸，版面比例的唯一依據 */
  width: number
  height: number
  isHdr: boolean

  /** ISO 8601 含時區，只用於排序 */
  takenAt: string
  /** 'YYYY-MM-DDTHH:mm:ss'，無時區。顯示與年份分組一律用這個 */
  takenAtLocal: string
  takenAtPrecision: PhotoTakenAtPrecision

  location?: PhotoLocation
  exif?: PhotoExif
  locales: PhotoLocales

  status: PhotoStatus
  createdAt: string
  updatedAt: string
}

export interface CreatePhotoInput {
  slug: string
  derivatives: PhotoDerivative[]
  urlOriginal: string
  urlOg: string
  blurDataUrl?: string
  originalMime: string
  originalBytes: number
  width: number
  height: number
  isHdr?: boolean
  takenAt: string
  takenAtLocal: string
  takenAtPrecision?: PhotoTakenAtPrecision
  location?: PhotoLocation
  exif?: PhotoExif
  locales?: PhotoLocales
  status?: PhotoStatus
}

/** 後台只編輯 metadata，圖檔欄位在上傳後就不再變動。 */
export interface UpdatePhotoInput {
  id: string
  slug?: string
  takenAt?: string
  takenAtLocal?: string
  takenAtPrecision?: PhotoTakenAtPrecision
  location?: PhotoLocation | null
  exif?: PhotoExif | null
  locales?: PhotoLocales
  status?: PhotoStatus
}
