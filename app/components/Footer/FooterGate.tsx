'use client'

import { useSelectedLayoutSegment } from 'next/navigation'
import { usePathname } from '@/i18n/navigation'

/**
 * Footer 是 async Server Component，無法直接呼叫 usePathname。
 * 這裡用一個 client wrapper 包住已渲染好的 Footer，依路徑決定是否顯示——
 * 後台有自己的外殼，不需要公開站的 Footer。
 */
export default function FooterGate({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const segment = useSelectedLayoutSegment()
  // 看路由 segment 而不是網址：後台子網域的網址裡沒有 /admin。
  if (segment === 'admin') return null
  // 攝影牆是滿版沉浸式（fixed），不要 footer；但單張頁 /photography/[slug] 是一般頁面要保留。
  if (pathname.startsWith('/photography')) return null
  return <>{children}</>
}
