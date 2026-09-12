import type { NextConfig } from 'next'

import createNextIntlPlugin from 'next-intl/plugin'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 本機用 admin.localhost:3000 開後台子網域，不列進來 dev server 會擋掉它的 HMR 與開發資源。
  allowedDevOrigins: ['admin.localhost'],
  typescript: {
    ignoreBuildErrors: false,
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
