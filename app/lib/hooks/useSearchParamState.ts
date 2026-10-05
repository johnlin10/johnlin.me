'use client'

import { useCallback } from 'react'
import { useSearchParams } from 'next/navigation'

/**
 * 把單一 query string 參數當成 state 讀寫，重整頁面後狀態還在。
 *
 * 寫入走原生 history.replaceState 而不是 next router：router.replace 會觸發
 * RSC 重抓，把頁面已經載入的資料和捲動位置一起重置（同 useWallUrlSync 的
 * 理由）。原生 History API 會被 Next 同步進 router，useSearchParams 照樣讀
 * 得到新值。
 *
 * 預設用 replaceState：篩選器不該在歷程裡堆出一串條目，使用者按上一頁
 * 預期回到的是上一個頁面，不是上一個篩選條件。像「打開單張」這種使用者
 * 會預期按上一頁（或手機的返回手勢）就退回來的切換，才傳 { push: true }。
 *
 * 值一律是字串（或 null＝參數不存在）。解析與驗證留給呼叫端——網址是使用者
 * 打得出來的輸入，能接受哪些值只有呼叫端知道。
 */
export function useSearchParamState(
  key: string
): [string | null, (value: string | null, options?: { push?: boolean }) => void] {
  const searchParams = useSearchParams()

  const setValue = useCallback(
    (value: string | null, options?: { push?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)

      const query = params.toString()
      // 清空時連問號一起拿掉，網址不要留一個裸露的 "?"。
      const url = query ? `?${query}` : window.location.pathname
      if (options?.push) window.history.pushState(null, '', url)
      else window.history.replaceState(null, '', url)
    },
    [key, searchParams]
  )

  return [searchParams.get(key), setValue]
}
