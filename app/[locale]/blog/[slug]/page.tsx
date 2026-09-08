import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/app/lib/supabase/server'
import { getPostBySlug } from '@/app/lib/supabase/posts'
import { formatPostDate } from '@/app/lib/blog/formatPostDate'
import { readingTimeMinutes } from '@/app/lib/blog/readingTime'
import { getCategoryById } from '@/app/lib/supabase/categories'
import { getTagsByIds } from '@/app/lib/supabase/tags'
import PageContainer from '@/app/components/PageContainer/PageContainer'
import PostContent from '@/app/components/blog/PostContent/PostContent'
import TableOfContents from '@/app/components/blog/TableOfContents/TableOfContents'
import ViewTracker from '@/app/components/blog/ViewTracker/ViewTracker'
import JsonLd from '@/app/components/JsonLd/JsonLd'
import { blogPostingJsonLd } from '@/app/lib/jsonLd'
import { SITE_CONFIG } from '@/app/lib/siteConfigs'
import type { Metadata } from 'next'
import type { SupportedLocale } from '@/app/types/blog'
import style from './post.module.scss'

interface PostPageProps {
  params: Promise<{ locale: string; slug: string }>
}

function localized<T extends { name: string }>(
  locales: Record<SupportedLocale, T>,
  locale: SupportedLocale
): T {
  return locales[locale]?.name ? locales[locale] : locales['zh-tw']
}

import { metadata } from '@/app/lib/metadata'

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { locale: localeParam, slug } = await params
  const locale = localeParam as SupportedLocale
  const supabase = await createClient()
  const post = await getPostBySlug(supabase, slug)
  if (!post) return metadata({ title: 'Post Not Found', description: '' })

  const content = post.locales[locale]?.title
    ? post.locales[locale]
    : post.locales['zh-tw']
  const seo = content.seo

  return metadata({
    title: seo?.metaTitle || content.title,
    description: seo?.metaDescription || content.description,
    keywords: seo?.keywords,
    image: post.coverImage?.url,
    url: `/blog/${slug}`,
    type: 'article',
    publishedTime: post.publishedAt
      ? new Date(post.publishedAt).toISOString()
      : undefined,
    modifiedTime: post.updatedAt
      ? new Date(post.updatedAt).toISOString()
      : undefined,
  })
}

export default async function PostPage({ params }: PostPageProps) {
  const { locale: localeParam, slug } = await params
  const locale = localeParam as SupportedLocale

  const supabase = await createClient()
  const post = await getPostBySlug(supabase, slug)
  if (!post || post.status !== 'published') notFound()

  const t = await getTranslations({ locale, namespace: 'BlogPage' })

  const hasLocale = !!post.locales[locale]?.title
  const content = hasLocale ? post.locales[locale] : post.locales['zh-tw']
  const isFallback = !hasLocale && locale !== 'zh-tw'

  const category = post.categoryId
    ? await getCategoryById(supabase, post.categoryId)
    : null
  const tags = post.tagIds.length
    ? await getTagsByIds(supabase, post.tagIds)
    : []

  const published = post.publishedAt ?? post.createdAt
  const date = formatPostDate(published, locale)
  const minutes = readingTimeMinutes(content.content)

  const toc = content.toc ?? []
  const hasToc = toc.length > 0

  const canonicalPath = `${SITE_CONFIG.url}${locale === 'en' ? '/en' : ''}/blog/${slug}`

  return (
    <PageContainer maxWidth={hasToc ? 'wide' : 'content'}>
      <JsonLd
        data={blogPostingJsonLd({
          title: content.title,
          description: content.seo?.metaDescription || content.description,
          image: post.coverImage?.url,
          url: canonicalPath,
          datePublished: post.publishedAt
            ? new Date(post.publishedAt).toISOString()
            : undefined,
          dateModified: post.updatedAt
            ? new Date(post.updatedAt).toISOString()
            : undefined,
          locale,
        })}
      />
      <ViewTracker postId={post.id} />
      <article>
        {post.coverImage && (
          <div className={style.cover}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.coverImage.url} alt={post.coverImage.alt} />
          </div>
        )}

        <div className={`${style.layout} ${hasToc ? style.withToc : ''}`}>
          <div>
            <header className={style.header}>
              <h1 className={style.title}>{content.title}</h1>
              <div className={style.meta}>
                {date && <time dateTime={published}>{date}</time>}
                <span>{t('readingTime', { minutes })}</span>
              </div>

              {(category || tags.length > 0) && (
                <div className={style.taxonomy}>
                  {category && (
                    <span className={style.category}>
                      {localized(category.locales, locale).name}
                    </span>
                  )}
                  {tags.length > 0 && (
                    <div className={style.tags}>
                      {tags.map((tg) => (
                        <span key={tg.id} className={style.tag}>
                          #{localized(tg.locales, locale).name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </header>

            {isFallback && <p className={style.fallbackNote}>{t('fallbackNote')}</p>}

            <PostContent content={content.content} />

            <div className={style.footer}>
              <Link href="/blog" className={style.backLink}>
                {t('backToList')}
              </Link>
            </div>
          </div>

          {hasToc && (
            <aside className={style.sidebar}>
              <TableOfContents items={toc} />
            </aside>
          )}
        </div>
      </article>
    </PageContainer>
  )
}
