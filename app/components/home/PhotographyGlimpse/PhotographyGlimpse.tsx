import { getTranslations } from 'next-intl/server'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { Link } from '@/i18n/navigation'
import Reveal from '../Reveal/Reveal'
import shared from '../shared.module.scss'
import style from './PhotographyGlimpse.module.scss'

// 目前無真實照片，用空相框骨架暗示未來相簿
const FRAMES = ['frameTall', 'frameWide', 'frameSquare']

export default async function PhotographyGlimpse({
  locale,
}: {
  locale: string
}) {
  const t = await getTranslations({
    locale,
    namespace: 'HomePage.photographyGlimpse',
  })

  return (
    <section className={shared.section}>
      <div className={shared.container}>
        <Reveal>
          <div className={shared.sectionHead}>
            <span className={shared.label}>{t('label')}</span>
            <h2 className={shared.heading}>{t('heading')}</h2>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className={style.glimpseEmpty}>
            <div className={style.ghostFrames} aria-hidden>
              {FRAMES.map((f, i) => (
                <span
                  key={f}
                  className={`${style.ghostFrame} ${style[f]}`}
                  style={{ ['--i' as string]: i }}
                />
              ))}
            </div>
            <p className={shared.emptyText}>{t('empty')}</p>
            <Link href="/gallery" className={`${shared.cta} ${shared.ctaGhost}`}>
              {t('cta')}
              <FontAwesomeIcon icon={faArrowRight} />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
