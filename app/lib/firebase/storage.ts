import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage'
import { storage } from '@/app/utils/firebase'

//* ==================== 圖片上傳 ====================

/**
 * 上傳圖片到 Firebase Storage
 * @param file 圖片檔案
 * @param path 儲存路徑（不含檔名）
 * @returns 圖片的公開 URL
 */
export async function uploadImage(file: File, path: string): Promise<string> {
  try {
    const timestamp = Date.now()
    const filename = `${timestamp}_${file.name}`
    const fullPath = `${path}/${filename}`

    const storageRef = ref(storage, fullPath)
    await uploadBytes(storageRef, file)

    const url = await getDownloadURL(storageRef)
    return url
  } catch (error) {
    console.error('上傳圖片失敗:', error)
    throw new Error('上傳圖片失敗')
  }
}

/**
 * 批次上傳圖片
 * @param files 圖片檔案陣列
 * @param path 儲存路徑
 * @returns 圖片 URL 陣列
 */
export async function uploadImages(
  files: File[],
  path: string
): Promise<string[]> {
  try {
    const uploadPromises = files.map((file) => uploadImage(file, path))
    return await Promise.all(uploadPromises)
  } catch (error) {
    console.error('批次上傳圖片失敗:', error)
    throw new Error('批次上傳圖片失敗')
  }
}

/**
 * 從 URL 刪除圖片
 * @param url 圖片 URL
 */
export async function deleteImageByUrl(url: string): Promise<void> {
  try {
    const storageRef = ref(storage, url)
    await deleteObject(storageRef)
  } catch (error) {
    console.error('刪除圖片失敗:', error)
    // 不拋出錯誤，因為圖片可能已經被刪除
  }
}

/**
 * 從 HTML 內容中提取圖片 URL
 * @param html HTML 內容
 * @returns 圖片 URL 陣列
 */
export function extractImageUrlsFromHtml(html: string): string[] {
  const imgRegex = /<img[^>]+src="([^">]+)"/g
  const urls: string[] = []
  let match

  while ((match = imgRegex.exec(html)) !== null) {
    urls.push(match[1])
  }

  return urls
}

/**
 * 將暫存的 base64 圖片上傳並替換為 Storage URL
 * @param html HTML 內容
 * @param postId 文章 ID
 * @returns 替換後的 HTML 內容
 */
export async function uploadAndReplaceImagesInHtml(
  html: string,
  postId: string
): Promise<string> {
  try {
    let updatedHtml = html

    // 找出所有 base64 圖片
    const base64Regex = /<img[^>]+src="(data:image\/[^;]+;base64,[^"]+)"/g
    const matches = [...html.matchAll(base64Regex)]

    for (const match of matches) {
      const base64Data = match[1]

      // 將 base64 轉換為 File
      const file = await base64ToFile(base64Data)

      // 上傳到 Storage
      const url = await uploadImage(file, `blog/images/${postId}`)

      // 替換 HTML 中的 src
      updatedHtml = updatedHtml.replace(base64Data, url)
    }

    return updatedHtml
  } catch (error) {
    console.error('上傳並替換圖片失敗:', error)
    throw new Error('上傳並替換圖片失敗')
  }
}

//* ==================== 輔助函數 ====================

/**
 * 將 base64 字串轉換為 File 物件
 * @param base64 base64 字串
 * @returns File 物件
 */
async function base64ToFile(base64: string): Promise<File> {
  const response = await fetch(base64)
  const blob = await response.blob()
  const filename = `image_${Date.now()}.png`
  return new File([blob], filename, { type: blob.type })
}

