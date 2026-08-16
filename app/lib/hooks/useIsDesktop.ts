'use client'

import { useEffect, useState } from 'react'

// 對齊 app/styles/_breakpoints.scss 的 respond-to('desktop')（$bp-lg + 1 = 1025px）
// —— 這樣 JS 這裡的分流跟 SCSS 的版面斷點是同一個數字，不會各自認定不同的「桌機」。
const QUERY = '(min-width: 1025px)'

/**
 * 回傳目前是否為桌機版面。掛載前一律回 false（與 SSR 一致），避免 hydration
 * 不匹配 —— 跟 GalleryExperience 的 mounted 閘門是同一個理由。代價是桌機
 * 使用者會先看到一瞬間的手機版面再切回來，這是刻意接受的權衡。
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    setIsDesktop(mql.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isDesktop
}
