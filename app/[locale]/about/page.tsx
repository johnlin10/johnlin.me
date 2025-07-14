import { getTranslations } from 'next-intl/server'
import style from './about.module.scss'
import PageContainer from '@/app/components/PageContainer/PageContainer'

export async function generateMetadata() {
  const t = await getTranslations('AboutPage')

  return {
    title: t('title'),
  }
}

async function AboutPage() {
  const t = await getTranslations('AboutPage')

  return (
    <PageContainer className={style.about}>
      <h1>{t('page_title')}</h1>
      <p>{t('description')}</p>
    </PageContainer>
  )
}

export default AboutPage
