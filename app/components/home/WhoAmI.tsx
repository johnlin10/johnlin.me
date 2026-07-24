import { getTranslations } from 'next-intl/server'
import Reveal from './Reveal'
import style from './home.module.scss'

/**
 * 我是誰。策略：標題與小標「釘」在左欄（sticky，純 CSS），
 * 段落在右欄依序浮現流過——像「人是恆定的，思緒在流動」。
 * 不用視差漂移標題（那會妨礙閱讀，也是先前被詬病的濫用）。
 */
export default async function WhoAmI({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'HomePage.who' })
  const paragraphs = t.raw('paragraphs') as string[]

  return (
    <section className={style.section}>
      <div className={`${style.container} ${style.whoLayout}`}>
        <div className={style.whoIntro}>
          <Reveal>
            <span className={style.label}>{t('label')}</span>
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
