//* ==================== 可接受的照片格式 ====================
// 純模組，瀏覽器的選檔過濾與伺服器的 zod 驗證共用同一份清單 ——
// 兩邊各寫一份遲早會歪，而歪掉的症狀是「檔案傳上去了才被拒」。

/**
 * 白名單刻意很窄，因為每一種格式都要同時滿足三件事：
 * exifr 讀得到、瀏覽器 createImageBitmap 產得出預覽、sharp 解得開。
 *
 * 明確排除的兩種（都實測過）：
 * - HEIC：exifr@7 對 iOS 18 的 HEIC 直接 throw「Unknown file format」，
 *   而且 Chrome 也無法 createImageBitmap，預檢表根本畫不出來。
 * - DNG：sharp 能當 TIFF 打開，但拿到的是感光元件的 CFA raw 像素，
 *   產出來會是一整組綠色的衍生檔 —— 比讀不到還糟，因為它「成功」了。
 *   TIFF 一併不收，否則改個副檔名的 DNG 就能鑽進來。
 *
 * 兩者都請先從 Lightroom 匯出 JPEG，這也是既有的工作流程。
 */
export const PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const

export type PhotoMimeType = (typeof PHOTO_MIME_TYPES)[number]

const EXT_BY_MIME: Record<PhotoMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

export function isSupportedPhotoMime(mime: string): mime is PhotoMimeType {
  return (PHOTO_MIME_TYPES as readonly string[]).includes(mime)
}

/**
 * 副檔名一律由 MIME 推導，不看檔名 —— 物件 key 之後要拿來 delete-by-prefix，
 * 不能讓使用者取的檔名決定它長什麼樣。
 */
export function extForPhotoMime(mime: string): string | null {
  return isSupportedPhotoMime(mime) ? EXT_BY_MIME[mime] : null
}

/** `<input type="file">` 的 accept 屬性。 */
export const PHOTO_ACCEPT_ATTR = PHOTO_MIME_TYPES.join(',')
