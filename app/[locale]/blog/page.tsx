import { getPosts } from '@/app/lib/firebase/posts'
import Page from '@/app/components/Page/Page'
import PostCard from '@/app/components/blog/PostCard/PostCard'
import { getTranslations } from 'next-intl/server'
import type { SupportedLocale } from '@/app/types/blog'
import style from './blog.module.scss'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'BlogPage' })

  return {
    title: t('title'),
    description: t('description'),
  }
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: localeParam } = await params
  const locale = localeParam as SupportedLocale
  const t = await getTranslations({ locale, namespace: 'BlogPage' })

  // 取得已發布的文章
  const result = await getPosts({
    status: 'published',
    pageSize: 20,
  })

  return (
    <Page
      style={style.blog_container}
      // header={{
      //   title: t('page_title'),
      //   descriptions: [t('description')],
      // }}
    >
      {result.data.length === 0 ? (
        <div className={style.empty}>
          <p>{t('noPosts')}</p>
        </div>
      ) : (
        <div className={style.posts_grid}>
          {result.data.map((post) => (
            <PostCard key={post.id} post={post} locale={locale} />
          ))}
        </div>
      )}
    </Page>
  )
}
