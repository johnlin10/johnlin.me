import { getTranslations } from 'next-intl/server'
import style from './about.module.scss'
import PageContainer from '@/app/components/PageContainer/PageContainer'

type Props = {
  params: Promise<{
    locale: string
  }>
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'AboutPage' })

  return {
    title: t('title'),
  }
}

async function AboutPage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'AboutPage' })

  return (
    <PageContainer className={style.about}>
      <h1>{t('page_title')}</h1>
      <p>{t('description')}</p>
    </PageContainer>
  )
}

export default AboutPage
