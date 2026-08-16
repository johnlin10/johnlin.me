import type { PhotoLocales } from '@/app/types/photo'

//* ==================== 雙語欄位 ↔ PhotoLocales ====================
// 上傳預檢表與檢閱欄的編輯表單都用同一組四個扁平欄位（中／英 × 說明／地名），
// 收斂成 PhotoLocales 的規則只寫一次，兩邊共用。

export interface LocaleFieldsDraft {
  captionZh: string
  captionEn: string
  locationNameZh: string
  locationNameEn: string
}

/**
 * 空字串一律不寫入 —— 跟 photos.ts 讀出來時 normalizeLocales() 對「空字串
 * 等於沒填」的認定一致，寫入端也該用同一個標準，否則會存進一堆空字串的
 * locale entry，跟真的填了內容分不出來。
 */
export function buildPhotoLocales(fields: LocaleFieldsDraft): PhotoLocales {
  const locales: PhotoLocales = {}

  const zh: { caption?: string; locationName?: string } = {}
  if (fields.captionZh.trim()) zh.caption = fields.captionZh.trim()
  if (fields.locationNameZh.trim()) zh.locationName = fields.locationNameZh.trim()
  if (Object.keys(zh).length > 0) locales['zh-tw'] = zh

  const en: { caption?: string; locationName?: string } = {}
  if (fields.captionEn.trim()) en.caption = fields.captionEn.trim()
  if (fields.locationNameEn.trim()) en.locationName = fields.locationNameEn.trim()
  if (Object.keys(en).length > 0) locales.en = en

  return locales
}
