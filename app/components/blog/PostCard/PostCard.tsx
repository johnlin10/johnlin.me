import Link from 'next/link'
import Image from 'next/image'
import type { Post } from '@/app/types/blog'
import style from './PostCard.module.scss'

interface PostCardProps {
  post: Post
  locale: 'zh-tw' | 'en'
}

/**
 * 文章卡片組件
 */
export default function PostCard({ post, locale }: PostCardProps) {
  const content = post.locales[locale]
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
    <Link href={`/blog/${post.slug}`} className={style.post_card}>
      {post.coverImage && (
        <div className={style.cover_image}>
          <Image
            src={post.coverImage.url}
            alt={post.coverImage.alt}
            width={360}
            height={240}
          />
          <div className={style.gradient_blur}>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div className={style.gradient_overlay}></div>
          </div>
        </div>
      )}

      <div className={style.content}>
        <div className={style.title_description}>
          <h2 className={style.title}>{content.title}</h2>
          <p className={style.description}>{content.description}</p>
        </div>
        <div className={style.meta}>
          <time className={style.date}>{formattedDate}</time>
          {post.viewCount && post.viewCount > 0 && (
            <span className={style.views}>{post.viewCount} 次瀏覽</span>
          )}
        </div>
      </div>
    </Link>
  )
}
