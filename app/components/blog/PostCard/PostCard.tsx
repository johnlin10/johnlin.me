import Image from 'next/image'
import type { CSSProperties } from 'react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getCoverTint } from '@/app/lib/images/coverTint'
import { readingTimeMinutes } from '@/app/lib/blog/readingTime'
import { formatPostDate } from '@/app/lib/blog/formatPostDate'
import type { Post, SupportedLocale } from '@/app/types/blog'
import style from './PostCard.module.scss'

/**
 * 文章卡片。locale 缺內容時回退中文原文。
 *
 * 一份標記兩種版型：外層容器帶 `data-view="list"` 時會切成列表列，
 * 版面全靠 CSS grid 的 named area 換位置，不換 DOM（見 PostCard.module.scss）。
 * 沒有外層容器時就是卡片模式，所以首頁直接用也對。
 */
export default async function PostCard({
  post,
  locale,
}: {
  post: Post
  locale: SupportedLocale
}) {
  const t = await getTranslations({ locale, namespace: 'BlogPage' })

  const content = post.locales[locale]?.title
    ? post.locales[locale]
    : post.locales['zh-tw']
  const published = post.publishedAt ?? post.createdAt
  const date = formatPostDate(published, locale)
  const minutes = readingTimeMinutes(content.content)

  // 卡片底色的色相／彩度來自封面圖；明度固定由主題決定，所以文字對比永遠成立。
  const tint = post.coverImage ? await getCoverTint(post.coverImage.url) : null

  return (
    <Link
      href={`/blog/${post.slug}`}
      className={style.card}
      data-cover={post.coverImage ? 'true' : 'false'}
      data-tint={tint ? 'image' : 'none'}
      style={
        tint
          ? ({
              '--tint-h': String(tint.hue),
              '--tint-c': String(tint.chroma),
            } as CSSProperties)
          : undefined
      }
    >
      {post.coverImage && (
        <div className={style.cover}>
          <Image
            src={post.coverImage.url}
            alt={post.coverImage.alt}
            fill
            sizes="(max-width: 700px) 100vw, 400px"
          />
        </div>
      )}

      <div className={style.body}>
        <h3 className={style.title}>{content.title}</h3>
        {content.description && (
          <p className={style.desc}>{content.description}</p>
        )}
      </div>

      {date && (
        <time className={style.date} dateTime={published}>
          {date}
        </time>
      )}
      <span className={style.meta}>{t('readingTime', { minutes })}</span>
    </Link>
  )
}
