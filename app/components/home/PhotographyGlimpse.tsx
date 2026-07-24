import { getTranslations } from 'next-intl/server'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { Link } from '@/i18n/navigation'
import Reveal from './Reveal'
import style from './home.module.scss'

/**
 * 攝影一瞥。真實照片要到攝影階段才有 → 目前空狀態。
 * 用「空相框」骨架暗示未來的相簿，與文章的純文字空狀態做出區隔；
 * 同樣不加捲動視差，只做安靜的淡入與極輕微的呼吸微光。
 */
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
    <section className={style.section}>
      <div className={style.container}>
        <Reveal>
          <div className={style.sectionHead}>
            <span className={style.label}>{t('label')}</span>
            <h2 className={style.heading}>{t('heading')}</h2>
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
            <p className={style.emptyText}>{t('empty')}</p>
            <Link href="/gallery" className={`${style.cta} ${style.ctaGhost}`}>
              {t('cta')}
              <FontAwesomeIcon icon={faArrowRight} />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
