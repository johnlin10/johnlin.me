/** 沒人用的圖片要放這麼久才由掃描刪：剛上傳、還沒存進資料庫的圖不能被當成孤兒。 */
export const ORPHAN_GRACE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * 決定要刪哪些文章圖片資料夾。
 * 呼叫端點名的（剛換掉、剛刪掉文章的）沒人用就刪；其餘 R2 上的資料夾要沒人用、而且最後寫入超過寬限期才刪。
 * @param requested 呼叫端點名的圖片 id
 * @param folders R2 上每個圖片資料夾 id → 資料夾裡最新物件的寫入時間（毫秒）
 * @param inUse 所有文章與系列封面的資料轉成的字串，圖片 id 出現在裡面就算有人用
 * @param now 現在時間（毫秒）
 * @returns 要刪的圖片 id
 */
export function pickPostImagesToDelete(
  requested: Iterable<string>,
  folders: Map<string, number>,
  inUse: string,
  now: number
): string[] {
  const picked = new Set<string>()
  for (const id of requested) if (!inUse.includes(id)) picked.add(id)
  for (const [id, lastModified] of folders) {
    if (now - lastModified > ORPHAN_GRACE_MS && !inUse.includes(id)) picked.add(id)
  }
  return [...picked]
}
