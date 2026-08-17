//* ==================== 攝影 Photos 型別 ====================

/** SDR 衍生檔的一階。階數依原圖尺寸而定，不會有超過原圖長邊的階。 */
export interface PhotoDerivative {
  /**
   * 這個檔案的實際像素寬度，直接對應 srcSet 的 `${w}w` 描述子。
   * 是「寬」不是「長邊」——直幅照片若照長邊縮放，w 描述子就會說謊，
   * 瀏覽器會固定挑小一級的階。產圖時一律 resize({ width: w })。
   */
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
  /** 實體焦距（mm），鏡頭銘牌上的那個數字 */
  focalLength?: number
  /** 等效焦距（mm，35mm 片幅）。EXIF 0xA405 不是必填，可能沒有 */
  focalLength35?: number
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
  /**
   * 由呼叫端指定主鍵。上傳流程在瀏覽器端先產 UUID 當作 R2 的物件前綴
   * （`photos/<id>/…`），再拿同一個值當 row id，這樣刪除時不需要額外欄位
   * 就能反推物件位置。省略時由 DB 的 gen_random_uuid() 補。
   */
  id?: string
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
