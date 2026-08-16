import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { r2Client } from './client'
import { r2Env } from './env'
import { publicUrl } from './keys'

/** key 都含 UUID 且寫入後不再變動，所以可以放心 immutable。 */
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable'

/** DeleteObjects 每批上限就是 1000。 */
const DELETE_BATCH = 1000

/** 同時上傳幾個衍生檔。R2 吃得下更多，4 已經把序列延遲吃掉大半。 */
const PUT_CONCURRENCY = 4

export interface PutItem {
  key: string
  body: Buffer
  contentType: string
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
  opts?: { cacheControl?: string }
): Promise<string> {
  await r2Client().send(
    new PutObjectCommand({
      Bucket: r2Env().bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: opts?.cacheControl ?? IMMUTABLE_CACHE,
    })
  )
  return publicUrl(key)
}

/** 依序回傳各項目的公開網址（順序與輸入一致）。 */
export async function putObjects(items: PutItem[]): Promise<string[]> {
  const urls: string[] = new Array(items.length)
  let cursor = 0
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor++
      const item = items[index]
      urls[index] = await putObject(item.key, item.body, item.contentType)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(PUT_CONCURRENCY, items.length) }, worker)
  )
  return urls
}

export async function headObject(
  key: string
): Promise<{ contentType: string; contentLength: number } | null> {
  try {
    const res = await r2Client().send(
      new HeadObjectCommand({ Bucket: r2Env().bucket, Key: key })
    )
    return {
      contentType: res.ContentType ?? 'application/octet-stream',
      contentLength: res.ContentLength ?? 0,
    }
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}

/**
 * 取回整個物件。maxBytes 是必填而不是選填：沒有上限的話，一個簽錯大小的
 * 巨檔會讓函式 OOM 而不是回一個乾淨的 413。
 */
export async function getObjectBuffer(
  key: string,
  maxBytes: number
): Promise<Buffer> {
  const res = await r2Client().send(
    new GetObjectCommand({ Bucket: r2Env().bucket, Key: key })
  )
  const length = res.ContentLength ?? 0
  if (length > maxBytes) {
    throw new Error(`物件過大：${length} > ${maxBytes}`)
  }
  if (!res.Body) throw new Error(`物件沒有內容：${key}`)
  const bytes = await res.Body.transformToByteArray()
  return Buffer.from(bytes)
}

export async function listKeys(prefix: string): Promise<string[]> {
  const keys: string[] = []
  let token: string | undefined
  do {
    const res = await r2Client().send(
      new ListObjectsV2Command({
        Bucket: r2Env().bucket,
        Prefix: prefix,
        ContinuationToken: token,
      })
    )
    for (const item of res.Contents ?? []) {
      if (item.Key) keys.push(item.Key)
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)
  return keys
}

/**
 * 刪掉整個前綴底下的物件，回傳刪除數量。
 * 一張照片今天只有十幾個物件，但分頁與分批的迴圈還是要寫 ——
 * 少了它就是一次沒有任何錯誤訊息的部分刪除。
 */
export async function deletePrefix(prefix: string): Promise<number> {
  const keys = await listKeys(prefix)
  if (keys.length === 0) return 0

  const bucket = r2Env().bucket
  for (let i = 0; i < keys.length; i += DELETE_BATCH) {
    const batch = keys.slice(i, i + DELETE_BATCH)
    await r2Client().send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      })
    )
  }
  return keys.length
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const name = (error as { name?: unknown }).name
  const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
    ?.httpStatusCode
  return name === 'NotFound' || name === 'NoSuchKey' || status === 404
}
