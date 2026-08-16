'use client'

import { useTranslations } from 'next-intl'
import Button from '@/app/components/admin/Button/Button'
import style from './PhotoSheet.module.scss'

interface BulkActionBarProps {
  count: number
  busy: boolean
  onPublish: () => void
  onUnpublish: () => void
  onDelete: () => void
  onClear: () => void
}

/**
 * 勾選數 > 0 時才出現的批次操作列。一趟拍攝回來常常是整批發布，
 * 逐張進檢閱欄按發布會是 30 次往返。
 */
export default function BulkActionBar({
  count,
  busy,
  onPublish,
  onUnpublish,
  onDelete,
  onClear,
}: BulkActionBarProps) {
  const t = useTranslations('AdminPage.photos.bulk')

  if (count === 0) return null

  return (
    <div className={style.bulkBar}>
      <span className={style.bulkCount}>{t('selected', { count })}</span>
      <div className={style.bulkActions}>
        <Button size="small" variant="secondary" onClick={onPublish} disabled={busy}>
          {t('publish')}
        </Button>
        <Button size="small" variant="secondary" onClick={onUnpublish} disabled={busy}>
          {t('unpublish')}
        </Button>
        <Button size="small" variant="danger" onClick={onDelete} disabled={busy}>
          {t('delete')}
        </Button>
        <Button size="small" variant="ghost" onClick={onClear} disabled={busy}>
          {t('clear')}
        </Button>
      </div>
    </div>
  )
}
