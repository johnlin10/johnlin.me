import { getTranslations } from 'next-intl/server'
import { createPublicClient } from '@/app/lib/supabase/public'
import { getPublishedPhotos } from '@/app/lib/supabase/photos'
import { metadata } from '@/app/lib/metadata'
import type { SupportedLocale } from '@/app/types/blog'
import PageContainer from '@/app/components/PageContainer/PageContainer'
import PageHeader from '@/app/components/PageHeader/PageHeader'
import GalleryList from '@/app/components/gallery/GalleryList/GalleryList'
import GalleryExperience from '@/app/components/gallery/GalleryExperience'

type Props = {
  params: Promise<{ locale: string }>
}

// 純公開資料，用 public client（無 cookie）才能 ISR 靜態化。
export const revalidate = 300

export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'GalleryPage' })
  return metadata({
    title: t('title'),
    description: t('description'),
    url: '/gallery',
  })
}

export default async function GalleryPage({ params }: Props) {
  const { locale: localeParam } = await params
  const locale = localeParam as SupportedLocale
  const t = await getTranslations({ locale, namespace: 'GalleryPage' })

  const photos = await getPublishedPhotos(createPublicClient())

  // SSR 一律吐出語意化列表（SEO 內鏈 + no-JS + 手機 + 爬蟲）；
  // 桌機掛載後 GalleryExperience 升級成互動牆，列表退居降級層。
  const fallback = (
    <PageContainer maxWidth="wide">
      <PageHeader size="md" title={t('page_title')} lead={t('description')} />
      <GalleryList photos={photos} locale={locale} />
    </PageContainer>
  )

  return (
    <GalleryExperience photos={photos} locale={locale} fallback={fallback} />
  )
}
