//* ==================== R2 環境設定 ====================
// 這是整個 R2 層唯一讀取密鑰的地方，因此也是唯一需要防止被打包進瀏覽器的地方。

export interface R2Env {
  bucket: string
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  /** 公開讀取的網域根（自訂網域綁在 bucket 根，所以網址是 `${publicBase}/${key}`） */
  publicBase: string
  /** 部署命名空間。本機設 'dev/' 就不會寫進正式站的路徑，正式環境留空。 */
  keyPrefix: string
}

/**
 * repo 沒有裝 server-only，所以用執行期防護代替 build 期防護。
 * 真正的保險其實是密鑰不帶 NEXT_PUBLIC_ 前綴（Next 不會塞進 client bundle），
 * 這裡只是讓「不小心從 client component import」變成一句看得懂的錯誤，
 * 而不是一個 undefined 造成的 400。
 */
function assertServer(): void {
  if (typeof window !== 'undefined') {
    throw new Error('app/lib/r2 只能在伺服器端使用，不要從 client component import')
  }
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    // 少一個變數在 R2 那端只會回一個沒有上下文的 400 或 403，
    // 從錯誤訊息完全看不出是設定沒帶到，所以在這裡先攔下來講清楚。
    throw new Error(`缺少環境變數 ${name}`)
  }
  return value
}

export function r2Env(): R2Env {
  assertServer()
  const publicBase = required('NEXT_PUBLIC_R2_PUBLIC_BASE').replace(/\/+$/, '')
  const rawPrefix = process.env.R2_KEY_PREFIX ?? ''
  // 允許寫成 'dev' 或 'dev/'，統一補成後者
  const keyPrefix = rawPrefix && !rawPrefix.endsWith('/') ? `${rawPrefix}/` : rawPrefix

  return {
    bucket: required('R2_BUCKET'),
    endpoint: required('R2_S3_ENDPOINT'),
    accessKeyId: required('R2_ACCESS_KEY_ID'),
    secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
    publicBase,
    keyPrefix,
  }
}
