import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
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
}
