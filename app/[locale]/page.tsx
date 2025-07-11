import { getTranslations } from 'next-intl/server'
import style from './page.module.scss'
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
    <div className={style.home}>
      <main>
        <h1>{t('title')}</h1>
        <p>{t('description')}</p>

        {/* 主題切換元件示範 */}
        {/* <div>
          <h2>{t('theme_toggle')}</h2>
          <ThemeToggle />
        </div> */}

        {/* <div>
          <h2>{t('language_switch')}</h2>
          <LanguageSwitch />
        </div> */}
      </main>
      <footer></footer>
    </div>
  )
}
