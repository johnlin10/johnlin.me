import { getTranslations } from 'next-intl/server'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { Link } from '@/i18n/navigation'
import PostCard from '@/app/components/blog/PostCard/PostCard'
import Reveal from '../Reveal/Reveal'
import shared from '../shared.module.scss'
import style from './LatestArticles.module.scss'
import type { Post, SupportedLocale } from '@/app/types/blog'

// posts 由首頁查一次傳入，與 Hero 共用（不重複打 DB）
export default async function LatestArticles({
  locale,
  posts,
}: {
  locale: string
  posts: Post[]
}) {
  const t = await getTranslations({ locale, namespace: 'HomePage.articles' })

  return (
    <section className={`${shared.section} ${shared.sectionAlt}`}>
      <div className={shared.container}>
        <Reveal>
          <div className={shared.sectionHead}>
            <span className={shared.label}>{t('label')}</span>
            <h2 className={shared.heading}>{t('heading')}</h2>
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
              <Link href="/blog" className={`${shared.cta} ${shared.ctaGhost}`}>
                {t('cta')}
                <FontAwesomeIcon icon={faArrowRight} />
              </Link>
            </div>
          </Reveal>
        ) : (
          <Reveal delay={0.1}>
            <div className={style.empty}>
              <p className={shared.emptyText}>{t('empty')}</p>
              <Link href="/blog" className={`${shared.cta} ${shared.ctaGhost}`}>
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
