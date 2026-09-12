import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { createPublicClient } from '@/app/lib/supabase/public'
import {
  getPhotoBySlug,
  getPublishedPhotos,
} from '@/app/lib/supabase/photos'
import { metadata } from '@/app/lib/metadata'
import { SITE_CONFIG } from '@/app/lib/siteConfigs'
import { photoAltText, photoCaption } from '@/app/lib/photos/format'
import type { SupportedLocale } from '@/app/types/blog'
import PageContainer from '@/app/components/PageContainer/PageContainer'
import PhotoMeta from '@/app/components/gallery/PhotoMeta/PhotoMeta'
import PhotoJsonLd from '@/app/components/gallery/PhotoJsonLd'
import PhotoFrame from './PhotoFrame'
import styles from './photo.module.scss'

interface PhotoPageProps {
  params: Promise<{ locale: string; slug: string }>
}

// 純公開資料，用 public client（無 cookie）才能真正 ISR 靜態化。
export const revalidate = 300
export const dynamicParams = true

export async function generateStaticParams() {
  const photos = await getPublishedPhotos(createPublicClient())
  return routing.locales.flatMap((locale) =>
    photos.map((photo) => ({ locale, slug: photo.slug }))
  )
}

export async function generateMetadata({
  params,
}: PhotoPageProps): Promise<Metadata> {
  const { locale: localeParam, slug } = await params
  const locale = localeParam as SupportedLocale
  const photo = await getPhotoBySlug(createPublicClient(), slug)
  if (!photo || photo.status !== 'published') {
    return metadata({ title: 'Not Found', description: '' })
  }

  const caption = photoCaption(photo, locale)
  const alt = photoAltText(photo, locale)
  return metadata({
    title: caption || alt,
    description: alt,
    image: photo.urlOg,
    imageWidth: 1200,
    imageHeight: 630,
    url: `/photography/${slug}`,
    type: 'article',
  })
}

export default async function PhotoPage({ params }: PhotoPageProps) {
  const { locale: localeParam, slug } = await params
  const locale = localeParam as SupportedLocale

  const photo = await getPhotoBySlug(createPublicClient(), slug)
  if (!photo || photo.status !== 'published') notFound()

  const t = await getTranslations({ locale, namespace: 'GalleryPage' })
  // SITE_CONFIG.url 已 strip 尾斜線；直接用 env 會多一條斜線（johnlin.me//photography）
  const prefix = locale === routing.defaultLocale ? '' : `/${locale}`
  const pageUrl = `${SITE_CONFIG.url}${prefix}/photography/${slug}`

  return (
    <PageContainer maxWidth="wide">
      <PhotoJsonLd photo={photo} locale={locale} pageUrl={pageUrl} />

      <figure className={styles.figure}>
        <div
          className={styles.frame}
          style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
        >
          {/* 原生 <img> + 自產 srcSet，繞開 Vercel optimizer（R2 已備好各階）。
              單張頁是 LCP，用 fetchPriority=high 取代 next/image 的 priority。
              HDR 照片另外疊載原檔淡入，見 PhotoFrame。 */}
          <PhotoFrame photo={photo} alt={photoAltText(photo, locale)} />
        </div>

        <PhotoMeta
          photo={photo}
          locale={locale}
          as="figcaption"
          heading
          className={styles.caption}
        />
      </figure>

      <Link href="/photography" className={styles.back}>
        ← {t('backToList')}
      </Link>
    </PageContainer>
  )
}
