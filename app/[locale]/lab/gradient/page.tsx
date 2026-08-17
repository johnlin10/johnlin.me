import { getTranslations } from 'next-intl/server'
import PageContainer from '@/app/components/PageContainer/PageContainer'
import PageHeader from '@/app/components/PageHeader/PageHeader'
import { metadata } from '@/app/lib/metadata'
import GradientLab from './GradientLab'

async function GradientPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'LabPage.GradientPage' })

  return (
    <PageContainer maxWidth="wide">
      <PageHeader size="md" title={t('title')} lead={t('description')} />
      <GradientLab />
    </PageContainer>
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'LabPage.GradientPage' })

  return metadata({
    title: t('title'),
    description: t('description'),
    url: '/lab/gradient',
  })
}

export default GradientPage
