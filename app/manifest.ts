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
      {
        src: '/assets/start-bg/manifest-icon-192.maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/assets/start-bg/manifest-icon-192.maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/assets/start-bg/manifest-icon-512.maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/assets/start-bg/manifest-icon-512.maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
