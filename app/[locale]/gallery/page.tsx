import PageContainer from '@/app/components/PageContainer/PageContainer'
import { getTranslations } from 'next-intl/server'
import style from './gallery.module.scss'

type Props = {
  params: Promise<{
    locale: string
  }>
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'GalleryPage' })

  return {
    title: t('title'),
    description: t('description'),
  }
}

async function GalleryPage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'GalleryPage' })

  return (
    <PageContainer className={style.gallery}>
      <h1>{t('page_title')}</h1>
      <p>{t('description')}</p>
    </PageContainer>
  )
}

export default GalleryPage
