import { r2Env } from './env'

//* ==================== R2 物件命名 ====================
//
// 前綴用不可變的 assetId（= photos.id），不用 slug。
//
// slug 是會改的：改一次就得把十幾個物件 copy 到新前綴再刪掉舊的，
// 而檢閱欄的自動存檔沒有立場在每次打字時跑這種分散式交易。用 UUID 之後
// slug 變成純粹的 metadata，刪除也只要 deletePrefix(photoPrefix(photo.id))，
// 不需要額外欄位記住檔案在哪。
//
// 代價是 R2 後台看不出哪個資料夾是哪張照片 —— 靠 DB 的 slug 對照，
// 或看 original 物件上的 x-amz-meta-slug（只在上傳時寫一次，不維護）。

/** `photos/<assetId>/`，含部署命名空間。 */
export function photoPrefix(assetId: string): string {
  return `${r2Env().keyPrefix}photos/${assetId}/`
}

/** 原檔。原樣保存不重新編碼，HDR 的 gain map 就靠這個物件活著。 */
export function originalKey(assetId: string, ext: string): string {
  return `${photoPrefix(assetId)}original.${ext}`
}

/** SDR 階梯的一階。width 是檔案實際寬度，對應 srcSet 的 `${w}w`。 */
export function derivativeKey(assetId: string, width: number): string {
  return `${photoPrefix(assetId)}w${width}.webp`
}

/** 1200×630 的社群預覽圖。 */
export function ogKey(assetId: string): string {
  return `${photoPrefix(assetId)}og.jpg`
}

/** 自訂網域綁在 bucket 根，所以不含 bucket 區段。 */
export function publicUrl(key: string): string {
  return `${r2Env().publicBase}/${key}`
}

/**
 * 從公開網址反推物件 key。正常路徑用不到（key 都算得出來），
 * 這是給孤兒清理用的後備：只有網址、沒有 id 的時候還原得回去。
 * 不是這個 bucket 的網址回 null，呼叫端就知道要跳過。
 */
export function keyFromPublicUrl(url: string): string | null {
  const base = `${r2Env().publicBase}/`
  return url.startsWith(base) ? url.slice(base.length) : null
}
