import styles from './PageContainer.module.scss'

export default function PageContainer({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={styles.page}>
      <div className={`${styles.page_container} ${className}`}>{children}</div>
    </div>
  )
}
