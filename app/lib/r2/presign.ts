import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { extForPhotoMime } from '@/app/lib/photos/mime'
import { r2Client } from './client'
import { r2Env } from './env'
import { originalKey, publicUrl } from './keys'

/** 15 分鐘。42 MB 的原檔在一般上傳頻寬下綽綽有餘。 */
const EXPIRES_IN = 900

export interface PresignedUpload {
  key: string
  uploadUrl: string
  publicUrl: string
  expiresIn: number
}

/**
 * 產生原檔直傳 R2 的 presigned PUT。
 *
 * 之所以要直傳而不是經過 route handler：Vercel 的 request body 上限是 4.5 MB，
 * 一張 42 MB 的原檔永遠進不了函式。ingest 那支改成從 R2 把檔案抓回來處理。
 *
 * 這裡刻意「不簽」三樣東西，每一樣簽下去都會變成無從查起的 403：
 * - ContentLength：瀏覽器自己會送，簽了就必須一個位元組都不差
 * - ACL：R2 直接拒絕帶 ACL 的請求
 * - ChecksumAlgorithm：見 client.ts 的說明
 *
 * 大小限制改在呼叫端驗 contentLength 之後「不發 URL」來達成。
 */
export async function presignOriginalPut(params: {
  assetId: string
  contentType: string
  contentLength: number
}): Promise<PresignedUpload> {
  const ext = extForPhotoMime(params.contentType)
  if (!ext) throw new Error(`不支援的格式：${params.contentType}`)

  const key = originalKey(params.assetId, ext)
  const uploadUrl = await getSignedUrl(
    r2Client(),
    new PutObjectCommand({
      Bucket: r2Env().bucket,
      Key: key,
      ContentType: params.contentType,
    }),
    { expiresIn: EXPIRES_IN }
  )

  // 實測這樣簽出來的 X-Amz-SignedHeaders 只有 host，Content-Type 沒有被簽進去
  // （這正是我們要的，多簽一個標頭就多一個 403 的來源）。代價是上傳端可以送別的
  // Content-Type，物件就會以那個型別存下來 —— 所以 ingest 一定要用 headObject
  // 讀回實際型別、重新推導 key 並比對，不能相信這裡發出去時的宣告。
  return { key, uploadUrl, publicUrl: publicUrl(key), expiresIn: EXPIRES_IN }
}
