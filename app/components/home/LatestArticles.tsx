import { getTranslations } from 'next-intl/server'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { Link } from '@/i18n/navigation'
import PostCard from '@/app/components/blog/PostCard/PostCard'
import Reveal from './Reveal'
import style from './home.module.scss'
import type { Post, SupportedLocale } from '@/app/types/blog'

/**
 * 最新文章。資料由首頁一次查詢後以 props 傳入（與 Hero 共用，不重複打 DB）。
 * 有資料時渲染最新三篇卡片，否則維持優雅的空狀態。
 */
export default async function LatestArticles({
  locale,
  posts,
}: {
  locale: string
  posts: Post[]
}) {
  const t = await getTranslations({ locale, namespace: 'HomePage.articles' })

  return (
    <section className={`${style.section} ${style.sectionAlt}`}>
      <div className={style.container}>
        <Reveal>
          <div className={style.sectionHead}>
            <span className={style.label}>{t('label')}</span>
            <h2 className={style.heading}>{t('heading')}</h2>
          </div>
        </Reveal>

        {posts.length > 0 ? (
          <Reveal delay={0.1}>
            <div className={style.articlesGrid}>
              {posts.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  locale={locale as SupportedLocale}
                />
              ))}
            </div>
            <div className={style.articlesCta}>
              <Link href="/blog" className={`${style.cta} ${style.ctaGhost}`}>
                {t('cta')}
                <FontAwesomeIcon icon={faArrowRight} />
              </Link>
            </div>
          </Reveal>
        ) : (
          <Reveal delay={0.1}>
            <div className={style.empty}>
              <p className={style.emptyText}>{t('empty')}</p>
              <Link href="/blog" className={`${style.cta} ${style.ctaGhost}`}>
                {t('cta')}
                <FontAwesomeIcon icon={faArrowRight} />
              </Link>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  )
}
