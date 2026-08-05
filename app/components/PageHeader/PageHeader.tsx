import styles from './PageHeader.module.scss'

export default function PageHeader({
  eyebrow,
  title,
  lead,
  size = 'lg',
}: {
  eyebrow?: string
  title: string
  lead?: string
  size?: 'lg' | 'md'
}) {
  return (
    <header
      className={`${styles.header} ${size === 'md' ? styles.md : ''}`}
    >
      {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
      <h1 className={styles.title}>{title}</h1>
      {lead && <p className={styles.lead}>{lead}</p>}
    </header>
  )
}
