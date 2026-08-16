//* ==================== Postgres 錯誤判斷 ====================
// 跨資料表共用。posts 與 photos 的 slug 都靠 DB 的 UNIQUE constraint 擋撞號，
// 兩邊都需要在 catch 裡分辨「撞號」與「真的壞掉」。

/**
 * 判斷是否為 Postgres 唯一鍵衝突（23505）。
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  )
}
