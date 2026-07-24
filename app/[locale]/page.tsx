import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getTranslations } from 'next-intl/server'
import Hero from '@/app/components/home/Hero'
import WhoAmI from '@/app/components/home/WhoAmI'
import ThreeThings from '@/app/components/home/ThreeThings'
import FeaturedWorks from '@/app/components/home/FeaturedWorks'
import LatestArticles from '@/app/components/home/LatestArticles'
import PhotographyGlimpse from '@/app/components/home/PhotographyGlimpse'

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

// Hero 的「程式」面板直接展示畫出它自己的原始碼——只讀檔案，不是 module import，沒有循環依賴問題。
async function getShowcaseSource() {
  try {
    const filePath = path.join(
      process.cwd(),
      'app/components/home/HeroShowcase.tsx'
    )
    const raw = await readFile(filePath, 'utf-8')
    // 只送前 200 行控制傳輸量；視覺上早就被 CSS 裁掉，這裡純粹是 payload 保險。
    return raw.split('\n').slice(0, 200).join('\n')
  } catch {
    return '// 原始碼讀取失敗，稍後補上\n'
  }
}

export default async function Home({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'HomePage' })
  const sourceCode = await getShowcaseSource()

  return (
    <main>
      <Hero
        tagline={t('tagline')}
        role={t('role')}
        scrollHint={t('hero.scrollHint')}
        sourceCode={sourceCode}
      />
      <WhoAmI locale={locale} />
      <ThreeThings locale={locale} />
      <FeaturedWorks locale={locale} />
      <LatestArticles locale={locale} />
      <PhotographyGlimpse locale={locale} />
    </main>
  )
}
