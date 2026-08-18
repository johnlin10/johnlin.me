import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import styles from './not-found.module.scss'

/**
 * 404 刻意不套 PageContainer / PageHeader，跟一般頁面拉開距離：
 * 一張沒沖洗出來的相紙，底片編號的位置放 404。
 */
export default async function NotFound() {
  const t = await getTranslations('NotFoundPage')

  return (
    <main className={styles.stage}>
      <div className={styles.print}>
        <div className={styles.blank} aria-hidden="true">
          <span className={styles.code}>404</span>
        </div>
        <p className={styles.caption}>{t('caption')}</p>
      </div>

      <div className={styles.body}>
        <h1 className={styles.title}>{t('title')}</h1>
        <p className={styles.lead}>{t('lead')}</p>
        <nav className={styles.links}>
          <Link href="/" className={styles.primary}>
            {t('home')}
          </Link>
          <Link href="/blog" className={styles.link}>
            {t('blog')}
          </Link>
          <Link href="/gallery" className={styles.link}>
            {t('gallery')}
          </Link>
        </nav>
      </div>
    </main>
  )
}
