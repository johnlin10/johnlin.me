import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import style from './about.module.scss'

type Props = {
  params: Promise<{
    locale: string
  }>
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'AboutPage' })

  return {
    title: t('title'),
    description: t('description'),
  }
}

const AVATAR = '/assets/images/johnlin.jpeg'
const EMAIL = 'johnlin@johnlin.me'
const SUBSTACK_URL = 'https://johnlin10.substack.com'
const GITHUB_URL = 'https://github.com/johnlin10'

// 敘事順序固定；firstWork / darkMonths 帶 pull-quote，throughline 帶三載體。
const SECTIONS = [
  'origin',
  'firstWork',
  'darkMonths',
  'anchor',
  'throughline',
  'values',
  'now',
] as const

async function AboutPage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'AboutPage' })
  const intro = t.raw('intro') as string[]

  return (
    <main className={style.about}>
      <div className={style.layout}>
        <aside className={style.sidebar}>
          <Image
            src={AVATAR}
            alt="John Lin"
            width={96}
            height={96}
            className={style.avatar}
            priority
          />
          <p className={style.name}>林昌龍 · John Lin</p>
          <p className={style.tagline}>{t('sidebar.tagline')}</p>
          <div className={style.contacts}>
            <a href={`mailto:${EMAIL}`} className={style.contactLink}>
              Email
            </a>
            <a
              href={SUBSTACK_URL}
              target="_blank"
              rel="me noopener noreferrer"
              className={style.contactLink}
            >
              Substack
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="me noopener noreferrer"
              className={style.contactLink}
            >
              GitHub
            </a>
          </div>
        </aside>

        <h1 className={style.storyTitle}>{t('storyTitle')}</h1>

        <div className={style.prose}>
          {intro.map((p, i) => (
            <p key={i} className={style.paragraph}>
              {p}
            </p>
          ))}

          {SECTIONS.map((key) => {
            const base = `sections.${key}`
            const paragraphs = t.raw(`${base}.paragraphs`) as string[]
            const hasPull = key === 'firstWork' || key === 'darkMonths'
            const isThroughline = key === 'throughline'

            return (
              <section key={key} className={style.block}>
                <h2 className={style.heading}>{t(`${base}.heading`)}</h2>
                {paragraphs.map((p, i) => (
                  <p key={i} className={style.paragraph}>
                    {p}
                  </p>
                ))}
                {hasPull && (
                  <blockquote className={style.pullQuote}>
                    {t(`${base}.pullQuote`)}
                  </blockquote>
                )}
                {isThroughline && (
                  <>
                    <ul className={style.carriers}>
                      {(t.raw(`${base}.carriers`) as string[]).map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                    <p className={style.paragraph}>
                      {t(`${base}.carriersOutro`)}
                    </p>
                  </>
                )}
              </section>
            )
          })}
        </div>
      </div>
    </main>
  )
}

export default AboutPage
