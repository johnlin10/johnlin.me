import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { SITE_CONFIG, isAdminHost } from '@/app/lib/siteConfigs'

/**
 * 主站與後台子網域共用這支 manifest，依 Host 回傳各自的 PWA 設定。
 * 用到 headers()，所以每次請求才產生，不在建置時快取。
 * @returns 目前網域的 Web App Manifest
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const site: MetadataRoute.Manifest = {
    name: 'John Lin',
    id: 'johnlin.me',
    short_name: 'John Lin',
    description: 'A web developer, photographer, and thinker.',
    start_url: '/',
    display: 'standalone',
    background_color: '#131313',
    theme_color: '#131313',
    icons: [
      // any：full-bleed 深色底，沒有留白，給不套用遮罩的啟動器直接顯示用
      {
        src: '/assets/icons/pwa-icons/johnlin-logo-pwa-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/assets/icons/pwa-icons/johnlin-logo-pwa-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      // maskable：套遮罩後會被裁掉四角留白，效果已經人工確認過可接受
      {
        src: '/assets/icons/pwa-icons/johnlin-logo-pwa-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/assets/icons/pwa-icons/johnlin-logo-pwa-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }

  if (!isAdminHost((await headers()).get('host'))) return site

  // 圖示暫時沿用主站。
  return {
    ...site,
    name: SITE_CONFIG.admin.name,
    id: 'admin.johnlin.me',
    short_name: SITE_CONFIG.admin.shortName,
    description: 'Content dashboard for johnlin.me.',
  }
}
