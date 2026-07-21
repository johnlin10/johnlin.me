import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import style from './Footer.module.scss'

// 外部連結。Substack 網址待確認（見 SUBSTACK_URL）。
const GITHUB_URL = 'https://github.com/johnlin10'
const SUBSTACK_URL = 'https://johnlin10.substack.com'
const EMAIL = 'johnlin@johnlin.me'

const NAV_ITEMS = [
  { href: '/blog', key: 'blog' },
  { href: '/gallery', key: 'gallery' },
  { href: '/about', key: 'about' },
] as const

export default async function Footer() {
  const t = await getTranslations('Footer')
  const nav = await getTranslations('Header')
  const year = new Date().getFullYear()

  return (
    <footer className={style.footer}>
      <div className={style.inner}>
        <div className={style.brandCol}>
          <p className={style.brand}>林昌龍 · John Lin</p>
          <p className={style.tagline}>{t('tagline')}</p>
        </div>

        <nav className={style.col} aria-label="footer navigation">
          <p className={style.colTitle}>{t('explore')}</p>
          {NAV_ITEMS.map(({ href, key }) => (
            <Link key={href} href={href} className={style.link}>
              {nav(key)}
            </Link>
          ))}
        </nav>

        <div className={style.col}>
          <p className={style.colTitle}>{t('connect')}</p>
          <a href={`mailto:${EMAIL}`} className={style.link}>
            Email
          </a>
          <a
            href={SUBSTACK_URL}
            target="_blank"
            rel="me noopener noreferrer"
            className={style.link}
          >
            Substack
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="me noopener noreferrer"
            className={style.link}
          >
            GitHub
          </a>
        </div>
      </div>

      <div className={style.bottom}>
        <span>
          © {year} 林昌龍 · {t('rights')}
        </span>
        <span className={style.builtWith}>Built with Next.js</span>
      </div>
    </footer>
  )
}
