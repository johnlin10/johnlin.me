'use client'

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
  if (pathname.startsWith('/admin')) return null
  return <>{children}</>
}
