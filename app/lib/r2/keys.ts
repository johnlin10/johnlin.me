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

/** 所有照片物件的共同根前綴，含部署命名空間。孤兒盤點從這裡開始掃。 */
export function photosRootPrefix(): string {
  return `${r2Env().keyPrefix}photos/`
}

/** `photos/<assetId>/`，含部署命名空間。 */
export function photoPrefix(assetId: string): string {
  return `${photosRootPrefix()}${assetId}/`
}

/**
 * 從物件 key 反推 assetId。不是這個 bucket／命名空間下的照片物件就回 null，
 * 呼叫端據此跳過 —— 盤點時 bucket 裡可能有跟照片無關的東西，不該誤判成孤兒。
 */
export function assetIdFromKey(key: string): string | null {
  const root = photosRootPrefix()
  if (!key.startsWith(root)) return null
  const rest = key.slice(root.length)
  const slash = rest.indexOf('/')
  return slash > 0 ? rest.slice(0, slash) : null
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

//* ==================== 短文媒體 ====================
// notes/images/<id>/ 放短文圖片的原檔與顯示用小圖，notes/links/<id>.webp 放網址預覽卡的封面。

/** 所有短文物件的共同根前綴，含部署命名空間。 */
export function notesRootPrefix(): string {
  return `${r2Env().keyPrefix}notes/`
}

/** `notes/images/<id>/`，一張短文圖片的資料夾。 */
export function noteImagePrefix(id: string): string {
  return `${notesRootPrefix()}images/${id}/`
}

/** 短文圖片原檔，原樣保存不重新編碼。 */
export function noteOriginalKey(id: string, ext: string): string {
  return `${noteImagePrefix(id)}original.${ext}`
}

/** 短文裡顯示用的小圖。 */
export function noteDisplayKey(id: string): string {
  return `${noteImagePrefix(id)}display.webp`
}

/** 網址預覽卡的封面。 */
export function noteLinkCoverKey(id: string): string {
  return `${notesRootPrefix()}links/${id}.webp`
}

/**
 * 短文媒體網址 → 要刪的前綴：圖片刪整個資料夾、封面刪單一物件。
 * 不是本站短文媒體的網址回 null；id 段一定要是 UUID，免得空字串把整個 notes/ 掃掉。
 */
export function noteMediaDeletePrefix(url: string): string | null {
  const key = keyFromPublicUrl(url)
  if (!key) return null
  const root = notesRootPrefix()
  const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
  const image = key.match(new RegExp(`^${root}images/(${uuid})/[^/]+$`))
  if (image) return noteImagePrefix(image[1])
  if (new RegExp(`^${root}links/${uuid}\\.webp$`).test(key)) return key
  return null
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
