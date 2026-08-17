import { getTranslations } from 'next-intl/server'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import Reveal from '../Reveal/Reveal'
import TiltLink from '../TiltLink/TiltLink'
import shared from '../shared.module.scss'
import style from './FeaturedWorks.module.scss'

type Work = { id: string; url: string; primary: boolean }

// 三個主打（robotctust / calens / stally）較大；其餘兩個較小、把版面填滿。
const WORKS: Work[] = [
  { id: 'robotctust', url: 'https://robotctust.com', primary: true },
  { id: 'calens', url: 'https://calens.app', primary: true },
  { id: 'stally', url: 'https://github.com/johnlin10/stally', primary: true },
  {
    id: 'ytdlp',
    url: 'https://github.com/johnlin10/ytdlp-server-rpi',
    primary: false,
  },
  { id: 'practions', url: 'https://practions.web.app', primary: false },
]

export default async function FeaturedWorks({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'HomePage.works' })
  const primary = WORKS.filter((w) => w.primary)
  const secondary = WORKS.filter((w) => !w.primary)

  return (
    <section className={shared.section}>
      <div className={shared.container}>
        <Reveal>
          <div className={style.worksHead}>
            <div>
              <span className={shared.label}>{t('label')}</span>
              <h2 className={shared.heading}>{t('heading')}</h2>
            </div>
          </div>
        </Reveal>

        <div className={style.worksPrimary}>
          {primary.map((w, i) => (
            <Reveal as="div" key={w.id} delay={i * 0.08} className={style.cardCell}>
              <TiltLink href={w.url} className={style.workCard}>
                <div className={style.workTop}>
                  <span className={style.workName}>
                    {t(`items.${w.id}.title`)}
                  </span>
                  <FontAwesomeIcon
                    icon={faArrowUpRightFromSquare}
                    className={style.workArrow}
                  />
                </div>
                <p className={style.workDesc}>{t(`items.${w.id}.description`)}</p>
                <span className={style.workBadge}>{t('visit')}</span>
              </TiltLink>
            </Reveal>
          ))}
        </div>

        <div className={style.worksSecondary}>
          {secondary.map((w, i) => (
            <Reveal as="div" key={w.id} delay={i * 0.08} className={style.cardCell}>
              <TiltLink
                href={w.url}
                max={4}
                className={`${style.workCard} ${style.workCardSmall}`}
              >
                <div style={{ flex: 1 }}>
                  <div className={style.workTop}>
                    <span className={`${style.workName} ${style.workNameSmall}`}>
                      {t(`items.${w.id}.title`)}
                    </span>
                    <FontAwesomeIcon
                      icon={faArrowUpRightFromSquare}
                      className={style.workArrow}
                    />
                  </div>
                  <p className={`${style.workDesc} ${style.workDescSmall}`}>
                    {t(`items.${w.id}.description`)}
                  </p>
                </div>
              </TiltLink>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
