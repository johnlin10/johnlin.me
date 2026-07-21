import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import style from './page.module.scss'

type Props = {
  params: Promise<{
    locale: string
  }>
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'HomePage' })

  return {
    title: 'John Lin | 林昌龍',
    description: t('description'),
    alternates: {
      canonical: locale === 'zh-tw' ? '/' : `/${locale}`,
      languages: {
        en: '/en',
        'zh-TW': '/',
        'x-default': '/',
      },
    },
  }
}

export default async function Home({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'HomePage' })

  return (
    <main className={style.home}>
      <section className={style.hero}>
        <Image
          src="/assets/images/johnlin.jpeg"
          alt="John Lin"
          width={72}
          height={72}
          className={style.avatar}
          priority
        />
        <h1 className={style.tagline}>{t('tagline')}</h1>
        <p className={style.role}>{t('role')}</p>
        <p className={style.hint}>{t('hint')}</p>
      </section>
    </main>
  )
}
