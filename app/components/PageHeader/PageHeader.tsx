import styles from './PageHeader.module.scss'

export default function PageHeader({
  title,
  lead,
  size = 'lg',
}: {
  title: string
  lead?: string
  size?: 'lg' | 'md'
}) {
  return (
    <header
      className={`${styles.header} ${size === 'md' ? styles.md : ''}`}
    >
      <h1 className={styles.title}>{title}</h1>
      {lead && <p className={styles.lead}>{lead}</p>}
    </header>
  )
}
