import styles from './PageContainer.module.scss'

type MaxWidth =
  | 'feed'
  | 'notes'
  | 'content'
  | 'wide'
  | 'max'
  | 'full'
  | 'max-content'

// content 是 .container 的預設寬度，不需要額外 modifier class。
const modifierClass: Record<MaxWidth, string | undefined> = {
  feed: styles.feed,
  notes: styles.notes,
  content: undefined,
  wide: styles.wide,
  max: styles.max,
  full: styles.full,
  'max-content': styles.maxContent,
}

export default function PageContainer({
  className,
  maxWidth = 'content',
  children,
}: {
  className?: string
  maxWidth?: MaxWidth
  children: React.ReactNode
}) {
  return (
    <div className={styles.page}>
      <div
        className={[styles.container, modifierClass[maxWidth], className]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </div>
    </div>
  )
}
