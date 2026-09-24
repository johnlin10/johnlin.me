import type { NextConfig } from 'next'

import createNextIntlPlugin from 'next-intl/plugin'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 本機用 studio.localhost:3000、tools.localhost:3000 開子網域，不列進來 dev server 會擋掉它們的 HMR 與開發資源。
  allowedDevOrigins: ['studio.localhost', 'tools.localhost'],
  typescript: {
    ignoreBuildErrors: false,
  },
  // 全站禁止被別的網站用 iframe 嵌入（後台尤其怕點擊劫持）；沒有任何頁面需要被嵌入。
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ]
  },
  // 攝影頁網址 /gallery → /photography（v1.2.2），舊連結轉過去。
  async redirects() {
    return [
      { source: '/gallery/:path*', destination: '/photography/:path*', permanent: true },
      { source: '/en/gallery/:path*', destination: '/en/photography/:path*', permanent: true },
    ]
  },
  // About 頁章節內容在執行期用 readdir/readFile 讀取，@vercel/nft 無法追蹤
  // 動態組出的路徑；沒有這行，正式站會安靜地讀不到檔案（About 頁變空白）。
  outputFileTracingIncludes: {
    '/[locale]/about': ['./content/about/**'],
    // 知識庫分享頁的 OG 圖在執行期讀字型和 logo
    '/api/kb/og': ['./fonts/src/GenKiMin2TW-SB.otf', './public/assets/icons/web-icons/johnlin-logo-256.png'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'myxssceptrkyjsibghjr.supabase.co', // Supabase Storage
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com', // Firebase Storage（退役後可移除）
        port: '',
        pathname: '/v0/b/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // Google 使用者頭像
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com', // Google Cloud Storage
        port: '',
        pathname: '/**',
      },
    ],
  },
}

const withNextIntl = createNextIntlPlugin()
export default withNextIntl(nextConfig)
