import { getTranslations } from 'next-intl/server'

async function AboutPage() {
  const t = await getTranslations('AboutPage')

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
    </div>
  )
}

export default AboutPage
