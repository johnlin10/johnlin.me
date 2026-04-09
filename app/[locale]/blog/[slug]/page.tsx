import { notFound } from 'next/navigation'
import {
  getPostBySlug,
  getPostsBySeries,
  incrementPostViewCount,
} from '@/app/lib/firebase/posts'
import { getCategoryById } from '@/app/lib/firebase/categories'
import { getTagsByIds } from '@/app/lib/firebase/tags'
import { getSeriesById } from '@/app/lib/firebase/series'
import PageContainer from '@/app/components/PageContainer/PageContainer'
import PostContent from '@/app/components/blog/PostContent/PostContent'
import TableOfContents from '@/app/components/blog/TableOfContents/TableOfContents'
import Link from 'next/link'
import type { Metadata } from 'next'
import type { Post, SupportedLocale } from '@/app/types/blog'
import style from './post.module.scss'

interface PostPageProps {
  params: Promise<{
    locale: string
    slug: string
  }>
}

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { locale: localeParam, slug } = await params
  const locale = localeParam as SupportedLocale
  const post = await getPostBySlug(slug)

  if (!post) {
    return {
      title: 'Post Not Found',
    }
  }

  const content = post.locales[locale]
  const seo = content.seo

  return {
    title: seo.metaTitle || content.title,
    description: seo.metaDescription || content.description,
    keywords: seo.keywords,
    openGraph: {
      title: seo.metaTitle || content.title,
      description: seo.metaDescription || content.description,
      images: post.coverImage ? [post.coverImage.url] : [],
    },
  }
}

export default async function PostPage({ params }: PostPageProps) {
  const { locale: localeParam, slug } = await params
  const locale = localeParam as SupportedLocale
  const post = await getPostBySlug(slug)

  if (!post || post.status !== 'published') {
    notFound()
  }

  // 增加瀏覽次數（不等待，忽略錯誤因為訪客沒有寫入權限）
  // TODO: 未來可以改用 Cloud Functions 或 API Route 來更新
  // incrementPostViewCount(post.id).catch(() => {})

  const content = post.locales[locale]
  const category = post.categoryId
    ? await getCategoryById(post.categoryId)
    : null
  const tags = post.tagIds.length > 0 ? await getTagsByIds(post.tagIds) : []

  let seriesInfo = null
  let seriesPosts: Post[] = []
  if (post.seriesId) {
    try {
      const series = await getSeriesById(post.seriesId)
      if (series) {
        seriesInfo = series
        seriesPosts = await getPostsBySeries(post.seriesId)
      }
    } catch (error) {
      console.error('取得系列資訊失敗，繼續顯示文章:', error)
      // 繼續顯示文章，只是沒有系列資訊
    }
  }

  const currentPostIndex = seriesPosts.findIndex((p) => p.id === post.id)
  const prevPost =
    currentPostIndex > 0 ? seriesPosts[currentPostIndex - 1] : null
  const nextPost =
    currentPostIndex < seriesPosts.length - 1
      ? seriesPosts[currentPostIndex + 1]
      : null

  const date = post.publishedAt?.toDate
    ? post.publishedAt.toDate()
    : post.createdAt.toDate()

  const formattedDate = date.toLocaleDateString(
    locale === 'zh-tw' ? 'zh-TW' : 'en-US',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }
  )

  return (
    <PageContainer className={style.post_page}>
      <article className={style.container}>
        {/* 封面圖片 */}
        {post.coverImage && (
          <div className={style.cover}>
            <img src={post.coverImage.url} alt={post.coverImage.alt} />
          </div>
        )}

        <div className={style.layout}>
          {/* 主要內容 */}
          <div className={style.main}>
            {/* 文章標題與元資訊 */}
            <header className={style.header}>
              <h1 className={style.title}>{content.title}</h1>

              <div className={style.meta}>
                <time className={style.date}>{formattedDate}</time>
                {post.viewCount && post.viewCount > 0 && (
                  <span className={style.views}>{post.viewCount} 次瀏覽</span>
                )}
              </div>

              {/* 分類與標籤 */}
              <div className={style.taxonomy}>
                {category && (
                  <Link
                    href={`/blog/category/${category.slug}`}
                    className={style.category}
                  >
                    {category.locales[locale].name}
                  </Link>
                )}

                {tags.length > 0 && (
                  <div className={style.tags}>
                    {tags.map((tag) => (
                      <Link
                        key={tag.id}
                        href={`/blog/tag/${tag.slug}`}
                        className={style.tag}
                      >
                        #{tag.locales[locale].name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </header>

            {/* 系列資訊 */}
            {seriesInfo && (
              <div className={style.series_info}>
                <div className={style.series_header}>
                  <span className={style.series_label}>連載系列</span>
                  <Link
                    href={`/blog/series/${seriesInfo.slug}`}
                    className={style.series_name}
                  >
                    {seriesInfo.locales[locale].name}
                  </Link>
                </div>
                <p className={style.series_description}>
                  {seriesInfo.locales[locale].description}
                </p>
              </div>
            )}

            {/* 文章內容 */}
            <div className={style.content}>
              <PostContent content={content.content} />
            </div>

            {/* 系列導航 */}
            {(prevPost || nextPost) && (
              <nav className={style.series_nav}>
                {prevPost && (
                  <Link
                    href={`/blog/${prevPost.slug}`}
                    className={`${style.nav_link} ${style.prev}`}
                  >
                    <span className={style.nav_label}>← 上一篇</span>
                    <span className={style.nav_title}>
                      {prevPost.locales[locale].title}
                    </span>
                  </Link>
                )}
                {nextPost && (
                  <Link
                    href={`/blog/${nextPost.slug}`}
                    className={`${style.nav_link} ${style.next}`}
                  >
                    <span className={style.nav_label}>下一篇 →</span>
                    <span className={style.nav_title}>
                      {nextPost.locales[locale].title}
                    </span>
                  </Link>
                )}
              </nav>
            )}
          </div>

          {/* 側邊欄：目錄 */}
          {content.toc && content.toc.length > 0 && (
            <aside className={style.sidebar}>
              <TableOfContents items={content.toc} />
            </aside>
          )}
        </div>
      </article>
    </PageContainer>
  )
}
