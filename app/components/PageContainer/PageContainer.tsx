import styles from './PageContainer.module.scss'

export default function PageContainer({
  className,
  maxWidth = 'small',
  children,
}: {
  className?: string
  maxWidth?: 'small' | 'medium' | 'large' | 'full' | 'max-content'
  children: React.ReactNode
}) {
  return (
    <div className={styles.page}>
      <div
        className={`${styles.page_container} ${className} ${styles[maxWidth]}`}
      >
        {children}
      </div>
    </div>
  )
}
