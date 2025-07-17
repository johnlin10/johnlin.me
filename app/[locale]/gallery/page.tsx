import PageContainer from '@/app/components/PageContainer/PageContainer'
import { getTranslations } from 'next-intl/server'
import style from './gallery.module.scss'

export async function generateMetadata() {
  const t = await getTranslations('BlogPage')

  return {
    title: t('title'),
    description: t('description'),
  }
}

async function GalleryPage() {
  const t = await getTranslations('GalleryPage')

  return (
    <PageContainer className={style.gallery}>
      <h1>{t('page_title')}</h1>
      <p>{t('description')}</p>
    </PageContainer>
  )
}

export default GalleryPage
