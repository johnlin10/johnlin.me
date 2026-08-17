import { getTranslations } from 'next-intl/server'
import Reveal from '../Reveal/Reveal'
import shared from '../shared.module.scss'
import style from './WhoAmI.module.scss'

// 標題 sticky 在左欄，段落在右欄依序浮現
export default async function WhoAmI({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'HomePage.who' })
  const paragraphs = t.raw('paragraphs') as string[]

  return (
    <section className={shared.section}>
      <div className={`${shared.container} ${style.whoLayout}`}>
        <div className={style.whoIntro}>
          <Reveal>
            <span className={shared.label}>{t('label')}</span>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className={style.whoHeading}>{t('heading')}</h2>
          </Reveal>
        </div>

        <div className={style.whoBody}>
          {paragraphs.map((p, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <p className={style.whoParagraph}>{p}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
