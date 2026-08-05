//* 讀取圖片的像素尺寸，供上傳時把 w/h 存進 NoteImage，以及舊資料的補尺寸流程共用。

export interface ImageSize {
  w: number
  h: number
}

/**
 * 讀取 File 的像素尺寸。
 * imageOrientation: 'from-image' 要明講——iPhone 直式照片常帶 EXIF 旋轉標記，
 * 不套用的話 decode 出來的寬高會跟瀏覽器實際畫出來的方向相反。
 */
export async function readImageSize(file: File): Promise<ImageSize> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      const size = { w: bitmap.width, h: bitmap.height }
      bitmap.close()
      return size
    } catch {
      // 部分格式／舊瀏覽器可能解碼失敗，退回 <img> 載入
    }
  }
  const objectUrl = URL.createObjectURL(file)
  try {
    return await readImageSizeFromUrl(objectUrl)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/** 從任意 URL（含既有的 Storage 公開網址）讀取像素尺寸，供舊資料補尺寸使用。 */
export function readImageSizeFromUrl(url: string): Promise<ImageSize> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => reject(new Error(`讀取圖片尺寸失敗：${url}`))
    img.src = url
  })
}
