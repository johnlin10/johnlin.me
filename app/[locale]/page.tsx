import { getTranslations } from 'next-intl/server'
import style from './page.module.scss'
import PageContainer from '@/app/components/PageContainer/PageContainer'
// import ThemeToggle from '@/app/components/ThemeToggle/ThemeToggle'
// import LanguageSwitch from '../components/LanguageSwitch/LanguageSwitch'

type Props = {
  params: Promise<{
    locale: string
  }>
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations('HomePage')

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: `/${locale}`,
      languages: {
        en: '/en',
        'zh-TW': '/zh-tw',
        'x-default': '/zh-tw',
      },
    },
  }
}

export default async function Home({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations('HomePage')

  return (
    <PageContainer className={style.home}>
      <main>
        <h1>{t('title')}</h1>
        <p>{t('description')}</p>
      </main>
      <footer></footer>
    </PageContainer>
  )
}
