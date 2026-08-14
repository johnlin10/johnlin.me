import { useCallback, useEffect, useRef } from 'react'
import { routing } from '@/i18n/routing'
import type { SupportedLocale } from '@/app/types/blog'

/**
 * 攝影牆聚焦時的網址同步。用原生 history API（Next 14.1+ 會同步內部狀態），
 * 不走 next router —— router 的 shallow 行為會觸發 RSC 重抓，牆會被重置。
 *
 * 進 focus：pushState 一次；focus 內換照片：replaceState；退出：history.back()，
 * 讓瀏覽器上一頁與退出走同一條 popstate 路徑。
 */
export function useWallUrlSync(
  locale: SupportedLocale,
  onPopSlug: (slug: string | null) => void
) {
  const prefix = locale === routing.defaultLocale ? '' : `/${locale}`
  const cb = useRef(onPopSlug)
  cb.current = onPopSlug

  const urlFor = useCallback(
    (slug: string | null) =>
      slug ? `${prefix}/gallery/${slug}` : `${prefix}/gallery`,
    [prefix]
  )

  const pushFocus = useCallback(
    (slug: string) => {
      window.history.pushState(null, '', urlFor(slug))
    },
    [urlFor]
  )

  const replaceFocus = useCallback(
    (slug: string) => {
      window.history.replaceState(null, '', urlFor(slug))
    },
    [urlFor]
  )

  const back = useCallback(() => {
    window.history.back()
  }, [])

  useEffect(() => {
    const handler = () => {
      // 從 /gallery 或 /(en/)gallery/<slug> 取出 slug（末段），/gallery 本身 → null
      const path = window.location.pathname
      const match = path.match(/\/gallery\/([^/]+)\/?$/)
      cb.current(match ? decodeURIComponent(match[1]) : null)
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  return { pushFocus, replaceFocus, back }
}
