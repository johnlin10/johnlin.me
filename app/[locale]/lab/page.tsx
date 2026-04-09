import Link from 'next/link'
import styles from './lab.module.scss'
import { getTranslations } from 'next-intl/server'
import Page from '@/app/components/Page/Page'
import { metadata } from '@/app/utils/metadata'

async function LabPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'LabPage' })

  return (
    <Page
      style={styles.lab}
      header={{
        title: t('page_title'),
        descriptions: [t('description')],
      }}
    >
      <Link href="/lab/palette" className={styles.link}>
        Palette
      </Link>
    </Page>
  )
}

// metadata
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'LabPage' })

  return metadata({
    title: t('title'),
    description: t('description'),
  })
}

export default LabPage
