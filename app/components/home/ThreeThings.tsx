import { getTranslations } from 'next-intl/server'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCode, faCamera, faPenNib } from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import Reveal from './Reveal'
import ScatterCard from './ScatterCard'
import style from './home.module.scss'

// 每張卡片的散落個性：靜置傾斜（scatter class）、視差深度、進場延遲。
// 刻意讓深度不同 → 捲動時三張各自以不同速度飄，像隨手擺放的照片。
const ITEMS: {
  key: string
  icon: IconDefinition
  scatter: string
  depth: number
}[] = [
  { key: 'web', icon: faCode, scatter: 'scatterA', depth: 46 },
  { key: 'photography', icon: faCamera, scatter: 'scatterB', depth: 78 },
  { key: 'writing', icon: faPenNib, scatter: 'scatterC', depth: 30 },
]

export default async function ThreeThings({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'HomePage.things' })

  return (
    <section className={`${style.section} ${style.sectionAlt}`}>
      <div className={style.container}>
        {/* 標題固定：只做一次性淡入，不隨捲動漂移 */}
        <Reveal>
          <span className={style.label}>{t('label')}</span>
        </Reveal>
        <Reveal delay={0.05}>
          <p className={style.thingsIntro}>{t('intro')}</p>
        </Reveal>

        <div className={style.thingsScatter}>
          {ITEMS.map(({ key, icon, scatter, depth }, i) => (
            <ScatterCard
              key={key}
              depth={depth}
              delay={i * 0.08}
              className={`${style.scatterCell} ${style[scatter]}`}
            >
              <div className={style.thingCard}>
                <span className={style.thingIcon}>
                  <FontAwesomeIcon icon={icon} />
                </span>
                <h3 className={style.thingTitle}>{t(`items.${key}.title`)}</h3>
                <p className={style.thingDesc}>
                  {t(`items.${key}.description`)}
                </p>
              </div>
            </ScatterCard>
          ))}
        </div>
      </div>
    </section>
  )
}
