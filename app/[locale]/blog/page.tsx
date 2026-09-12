import { Fragment } from 'react'
import { cookies } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/app/lib/supabase/server'
import { getPublishedPosts } from '@/app/lib/supabase/posts'
import { getTaipeiYear } from '@/app/lib/blog/formatPostDate'
import PageContainer from '@/app/components/PageContainer/PageContainer'
import PageHeader from '@/app/components/PageHeader/PageHeader'
import PostCard from '@/app/components/blog/PostCard/PostCard'
import PostList, { type BlogView } from '@/app/components/blog/PostList'
import YearDivider from '@/app/components/blog/PostList/YearDivider'
import type { Post, SupportedLocale } from '@/app/types/blog'
import style from './blog.module.scss'

import { metadata } from '@/app/lib/metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'BlogPage' })
  return metadata({
    title: t('title'),
    description: t('description'),
    url: '/blog',
  })
}

/** 依台北時區的年份分組。posts 已照 published_at 降冪排序，掃一次即可。 */
function groupByYear(posts: Post[]) {
  const groups: { year: number; posts: Post[] }[] = []
  for (const post of posts) {
    const year = getTaipeiYear(post.publishedAt ?? post.createdAt)
    if (year === null) continue
    const last = groups.at(-1)
    if (last?.year === year) last.posts.push(post)
    else groups.push({ year, posts: [post] })
  }
  return groups
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: localeParam } = await params
  const locale = localeParam as SupportedLocale
  const t = await getTranslations({ locale, namespace: 'BlogPage' })

  const supabase = await createClient()
  const { data: posts } = await getPublishedPosts(supabase, { pageSize: 30 })

  // 本頁本來就是動態渲染（Supabase client 綁 cookie），順手讀偏好就能在 SSR
  // 決定版型，不會有先渲染卡片再跳成列表的閃爍。
  const cookieStore = await cookies()
  const view: BlogView =
    cookieStore.get('blog-view')?.value === 'list' ? 'list' : 'card'

  const groups = groupByYear(posts)

  return (
    // 列表要放得下三欄卡片，用 wide（1080）而不是內文寬的 content（720）。
    <PageContainer maxWidth="wide">
      <PageHeader title={t('title')} lead={t('description')} />

      {posts.length === 0 ? (
        <div className={style.empty}>{t('noPosts')}</div>
      ) : (
        <PostList initialView={view}>
          {groups.map((group) => (
            // Fragment 不產生 DOM 節點，YearDivider 與 PostCard 都還是容器的
            // 直接子元素 —— 卡片模式的 grid-column: 1 / -1 才有效。
            <Fragment key={group.year}>
              <YearDivider year={group.year} locale={locale} />
              {group.posts.map((post) => (
                <PostCard key={post.id} post={post} locale={locale} />
              ))}
            </Fragment>
          ))}
        </PostList>
      )}
    </PageContainer>
  )
}
