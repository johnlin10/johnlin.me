import Link from 'next/link'
import styles from './lab.module.scss'
import { getTranslations } from 'next-intl/server'
import PageContainer from '@/app/components/PageContainer/PageContainer'
import PageHeader from '@/app/components/PageHeader/PageHeader'
import { metadata } from '@/app/lib/metadata'

async function LabPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'LabPage' })

  return (
    <PageContainer>
      <PageHeader size="md" title={t('page_title')} lead={t('description')} />
      <div className={styles.lab}>
        <Link href="/lab/design" className={styles.link}>
          Design System
        </Link>
        <Link href="/lab/gradient" className={styles.link}>
          Gradient Curve
        </Link>
      </div>
    </PageContainer>
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
    url: '/lab',
  })
}

export default LabPage
