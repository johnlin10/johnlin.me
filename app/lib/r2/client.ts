import { S3Client } from '@aws-sdk/client-s3'
import { r2Env } from './env'

let cached: S3Client | null = null

/**
 * R2 的 S3 相容用戶端。模組層快取一份，避免每個請求重建連線池。
 *
 * `requestChecksumCalculation: 'WHEN_REQUIRED'` 不是可有可無的調校：
 * AWS SDK v3 預設會替每個請求算 CRC32 並把 `x-amz-checksum-crc32` 列進
 * presigned URL 的 SignedHeaders，但瀏覽器 PUT 時不會送那個標頭，
 * 簽章對不起來就是一個沒有任何線索的 403。responseChecksumValidation
 * 同理，讀回來時 R2 不一定附上對應的標頭。
 */
export function r2Client(): S3Client {
  if (cached) return cached
  const env = r2Env()
  cached = new S3Client({
    region: 'auto',
    endpoint: env.endpoint,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
  return cached
}
