'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import Modal from '@/app/components/admin/Modal/Modal'
import Button from '@/app/components/admin/Button/Button'
import { useConfirm } from '@/app/components/admin/ConfirmDialog/ConfirmDialog'
import { useToast } from '@/app/components/admin/Toast/ToastProvider'
import style from './PhotoSheet.module.scss'

interface OrphanScan {
  orphaned: { assetId: string; objectCount: number }[]
  missing: { id: string; slug: string }[]
}

interface OrphanReportProps {
  isOpen: boolean
  onClose: () => void
  /** 清理完要重新載入照片清單（missing 那一側可能因此改變）。 */
  onCleaned: () => void
}

/**
 * 孤兒盤點。兩個方向都會查：
 * - orphaned：R2 有檔案、資料庫沒有列。上傳到一半放棄留下的，可以清掉。
 * - missing：資料庫有列、R2 沒有檔案。前台會是破圖，但要刪的是一筆有 slug
 *   有說明的資料，只回報、不提供一鍵清除 —— 該由人看過再決定。
 */
export default function OrphanReport({ isOpen, onClose, onCleaned }: OrphanReportProps) {
  const t = useTranslations('AdminPage.photos.orphans')
  const confirm = useConfirm()
  const toast = useToast()

  const [scan, setScan] = useState<OrphanScan | null>(null)
  const [loading, setLoading] = useState(false)
  const [cleaning, setCleaning] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setLoading(true)
    setScan(null)
    fetch('/api/admin/photos/orphans')
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (json.result) setScan(json.result)
        else toast.error(json.error ?? t('scanError'))
      })
      .catch(() => {
        if (!cancelled) toast.error(t('scanError'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen])

  const handleCleanup = async () => {
    if (!scan || scan.orphaned.length === 0) return
    const ok = await confirm({
      title: t('cleanupConfirmTitle'),
      message: t('cleanupConfirmMessage', { count: scan.orphaned.length }),
      danger: true,
    })
    if (!ok) return

    setCleaning(true)
    try {
      const res = await fetch('/api/admin/photos/orphans', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assetIds: scan.orphaned.map((o) => o.assetId) }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? t('cleanupError'))
        return
      }
      toast.success(t('cleanupSuccess', { count: json.result.removedObjects }))
      setScan({ ...scan, orphaned: [] })
      onCleaned()
    } catch {
      toast.error(t('cleanupError'))
    } finally {
      setCleaning(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('title')} size="medium">
      {loading ? (
        <p className={style.orphanEmpty}>{t('scanning')}</p>
      ) : !scan ? null : (
        <div className={style.orphanBody}>
          <section className={style.orphanSection}>
            <h3 className={style.orphanHeading}>{t('orphanedHeading')}</h3>
            {scan.orphaned.length === 0 ? (
              <p className={style.orphanEmpty}>{t('orphanedNone')}</p>
            ) : (
              <>
                <p className={style.orphanHint}>{t('orphanedHint')}</p>
                <ul className={style.orphanList}>
                  {scan.orphaned.map((o) => (
                    <li key={o.assetId}>
                      <code>{o.assetId}</code>
                      <span>{t('objectCount', { count: o.objectCount })}</span>
                    </li>
                  ))}
                </ul>
                <Button variant="danger" size="small" onClick={() => void handleCleanup()} disabled={cleaning}>
                  {t('cleanup')}
                </Button>
              </>
            )}
          </section>

          <section className={style.orphanSection}>
            <h3 className={style.orphanHeading}>{t('missingHeading')}</h3>
            {scan.missing.length === 0 ? (
              <p className={style.orphanEmpty}>{t('missingNone')}</p>
            ) : (
              <>
                <p className={style.orphanHint}>{t('missingHint')}</p>
                <ul className={style.orphanList}>
                  {scan.missing.map((m) => (
                    <li key={m.id}>
                      <code>{m.slug}</code>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      )}
    </Modal>
  )
}
