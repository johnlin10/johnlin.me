import Link from 'next/link'
import styles from './lab.module.scss'
import PageContainer from '@/app/components/PageContainer/PageContainer'

function LabPage() {
  return (
    <PageContainer className={styles.lab}>
      <h1>Lab</h1>
      <Link href="/lab/palette" className={styles.link}>
        Palette
      </Link>
    </PageContainer>
  )
}

export default LabPage
