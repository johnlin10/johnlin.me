import PageContainer from '@/app/components/PageContainer/PageContainer'
import { getTranslations } from 'next-intl/server'
import style from './blog.module.scss'

export async function generateMetadata() {
  const t = await getTranslations('BlogPage')

  return {
    title: t('title'),
    description: t('description'),
  }
}

async function BlogPage() {
  const t = await getTranslations('BlogPage')

  return (
    <PageContainer className={style.blog}>
      <h1>{t('page_title')}</h1>
      <p>{t('description')}</p>
    </PageContainer>
  )
}

export default BlogPage
