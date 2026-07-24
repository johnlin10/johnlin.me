import { getTranslations } from 'next-intl/server'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { Link } from '@/i18n/navigation'
import Reveal from './Reveal'
import style from './home.module.scss'

/**
 * 最新文章。Supabase 尚未接上 → 目前呈現優雅的空狀態。
 * 空狀態沒有需要「深度感」的內容，所以刻意不加視差——只做安靜的淡入。
 * 之後接資料時，把文章卡片渲染在空狀態之前即可。
 */
export default async function LatestArticles({ locale }: { locale: string }) {
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

        <Reveal delay={0.1}>
          <div className={style.empty}>
            <p className={style.emptyText}>{t('empty')}</p>
            <Link href="/blog" className={`${style.cta} ${style.ctaGhost}`}>
              {t('cta')}
              <FontAwesomeIcon icon={faArrowRight} />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
