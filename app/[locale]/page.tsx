import { getTranslations } from 'next-intl/server'
import style from './page.module.scss'
import PageContainer from '@/app/components/PageContainer/PageContainer'
// 修正：使用 next-intl 的 Link 組件
import { Link } from '@/i18n/navigation'
import Icon from '../components/Icon/Icon'

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
        <section className={style.section_hero}>
          <h1>{t('section_hero.title')}</h1>
          <p>{t('section_hero.intros.0')}</p>
          <p>{t('section_hero.intros.1')}</p>
          <div className={style.buttons}>
            <Link href="/about" className={style.button}>
              <span>關於我</span>
              <Icon name="arrow-right" className={style.icon} />
            </Link>
            <Link href="/blog" className={style.button}>
              <span>閱讀文章</span>
              <Icon name="arrow-right" className={style.icon} />
            </Link>
          </div>
        </section>
        <section className={style.section_live_life}>
          <p>{t('section_live_life.contents.0')}</p>
          <p>{t('section_live_life.contents.1')}</p>
          <p>{t('section_live_life.contents.2')}</p>
        </section>
        {/* 功能卡片 */}
        <section className={style.section_features}>
          <h1>{t('section_features.title')}</h1>
          <div className={style.feature_card_container}>
            <Link href="/blog" className={style.feature_card}>
              <h2>{t('section_features.blog.title')}</h2>
              <p>{t('section_features.blog.description')}</p>
            </Link>
            {/*<Link href="/gallery" className={style.feature_card}>
              <h2>{t('section_features.gallery.title')}</h2>
              <p>{t('section_features.gallery.description')}</p>
            </Link>
            <Link href="/shorten" className={style.feature_card}>
              <h2>{t('section_features.shorten.title')}</h2>
              <p>{t('section_features.shorten.description')}</p>
            </Link> */}
            <Link href="/about" className={style.feature_card}>
              <h2>{t('section_features.about.title')}</h2>
              <p>{t('section_features.about.description')}</p>
            </Link>
          </div>
        </section>
      </main>
      <footer></footer>
    </PageContainer>
  )
}
