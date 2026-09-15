// 去掉 l、o、0、1，剩 32 個字元；256 是 32 的倍數，取餘數不會偏向某些字元
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

/**
 * 產生隨機 slug。
 * @param length 長度
 * @returns 小寫英數 slug
 */
export function randomSlug(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => ALPHABET[b % 32]).join('')
}

/**
 * 自訂 slug 是否合法，規則跟資料庫的 check 一致。
 * @param slug 要檢查的 slug
 * @returns 合法回 true
 */
export function isValidSlug(slug: string): boolean {
  return (
    slug.length <= 64 &&
    /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) &&
    !/^(api|auth|trpc)/.test(slug)
  )
}

/**
 * 整理輸入的目標網址，沒寫協定就補 https://。
 * @param value 輸入的網址
 * @returns 正規化後的 http(s) 網址；不合法回 null
 */
export function normalizeTarget(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}
