import style from './page.module.scss'
import PageContainer from '@/app/components/PageContainer/PageContainer'

type Props = {
  params: Promise<{
    locale: string
  }>
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  
  return {
    title: '網站正在建設中 | Site Under Construction',
    description: '網站正在建設中 / Site is under construction',
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

export default async function Home() {
  return (
    <PageContainer className={style.home}>
      <main style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>網站正在建設中</h1>
        <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)' }}>Site is under construction</p>
      </main>
    </PageContainer>
  )
}
