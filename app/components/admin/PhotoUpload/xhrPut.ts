/**
 * PUT 一個檔案並回報上傳進度。
 *
 * fetch 沒有上傳進度事件（ReadableStream request body 那條路只有 Chrome
 * 支援，且對這裡沒幫助），XMLHttpRequest 的 upload.onprogress 是唯一選項。
 */
export function xhrPut(
  url: string,
  file: File,
  contentType: string,
  onProgress: (loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`上傳失敗（${xhr.status}）`))
    }
    xhr.onerror = () => reject(new Error('上傳失敗（網路錯誤）'))
    xhr.onabort = () => reject(new DOMException('上傳已取消', 'AbortError'))

    if (signal) {
      if (signal.aborted) {
        xhr.abort()
        return
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }

    xhr.send(file)
  })
}
