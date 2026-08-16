'use client'

import { useTranslations } from 'next-intl'
import Button from '@/app/components/admin/Button/Button'
import style from './PhotoUpload.module.scss'

interface UploadSummaryBarProps {
  pendingCount: number
  problemCount: number
  running: boolean
  allDone: boolean
  onConfirm: () => void
  onClearAll: () => void
  onCancel: () => void
}

/** 頁面底部固定的摘要列：待上傳／有問題張數、確認上傳、全部清除。 */
export default function UploadSummaryBar({
  pendingCount,
  problemCount,
  running,
  allDone,
  onConfirm,
  onClearAll,
  onCancel,
}: UploadSummaryBarProps) {
  const t = useTranslations('AdminPage.photos.upload')

  if (pendingCount === 0 && problemCount === 0 && !allDone) return null

  return (
    <div className={style.summaryBar}>
      <div className={style.summaryText}>
        {pendingCount > 0 && (
          <span>{t('summaryPending', { count: pendingCount })}</span>
        )}
        {problemCount > 0 && (
          <span className={style.summaryProblem}>
            {t('summaryProblem', { count: problemCount })}
          </span>
        )}
        {allDone && <span>{t('allDone')}</span>}
      </div>

      <div className={style.summaryActions}>
        {running ? (
          <Button variant="secondary" onClick={onCancel}>
            {t('cancel')}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClearAll}>
              {t('clearAll')}
            </Button>
            {pendingCount > 0 && (
              <Button onClick={onConfirm}>{t('confirm')}</Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
