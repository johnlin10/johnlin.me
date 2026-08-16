'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { createClient } from '@/app/lib/supabase/client'
import { getPhotosForAdmin } from '@/app/lib/supabase/photos'
import { formatTakenAt, photoCaption } from '@/app/lib/photos/format'
import type { Photo } from '@/app/types/photo'
import type { SupportedLocale } from '@/app/types/blog'
import DataTable, {
  type DataTableColumn,
} from '@/app/components/admin/DataTable/DataTable'
import { useToast } from '@/app/components/admin/Toast/ToastProvider'
import style from './photos.module.scss'

/**
 * 攝影管理（暫時型態）。
 *
 * 這一版刻意只做表格，用途是把資料層接通、確認 nav 與載入流程正常。
 * 正式的管理介面是印象表＋右側檢閱欄（見 Phase 5／6）——照片的辨識靠圖不靠欄位，
 * 表格會退居第二視圖，專門處理批次操作。
 */
export default function AdminPhotosPage() {
  const t = useTranslations('AdminPage.photos')
  const locale = useLocale() as SupportedLocale
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()

  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)

  // 宣告在 effect 之前：其他管理頁是反過來寫的，但那會踩到
  // react-hooks 的 use-before-declare 規則，新檔就不要再帶進同一個警告。
  const load = async () => {
    try {
      setLoading(true)
      setPhotos(await getPhotosForAdmin(supabase))
    } catch {
      toast.error(t('loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const columns: DataTableColumn<Photo>[] = [
    {
      key: 'thumb',
      header: t('table.thumb'),
      minWidth: '72px',
      // 原生 <img>：階梯最小階已經是縮圖尺寸，走 next/image 只是多付一次最佳化
      render: (photo) =>
        photo.derivatives[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={style.thumb}
            src={photo.derivatives[0].url}
            alt=""
            loading="lazy"
          />
        ) : (
          <span className={style.thumbMissing} aria-hidden />
        ),
    },
    {
      key: 'slug',
      header: t('table.slug'),
      render: (photo) => <code className={style.slug}>{photo.slug}</code>,
    },
    {
      key: 'takenAt',
      header: t('table.takenAt'),
      render: (photo) =>
        formatTakenAt(photo.takenAtLocal, photo.takenAtPrecision, locale),
    },
    {
      key: 'caption',
      header: t('table.caption'),
      wrap: true,
      maxWidth: '320px',
      render: (photo) => photoCaption(photo, locale) ?? t('none'),
    },
    {
      key: 'size',
      header: t('table.size'),
      render: (photo) => `${photo.width} × ${photo.height}`,
    },
    {
      key: 'status',
      header: t('table.status'),
      render: (photo) => (
        <span
          className={`${style.status} ${photo.status === 'published' ? style.published : style.draft}`}
        >
          {t(`status.${photo.status}`)}
        </span>
      ),
    },
  ]

  return (
    <div className={style.photos_page}>
      <div className={style.container}>
        <div className={style.header}>
          <div className={style.title_section}>
            <h1 className={style.title}>{t('heading')}</h1>
            <p className={style.subtitle}>
              {t('count.total')}
              {photos.length}
              {t('count.unit')}
            </p>
          </div>
        </div>

        {loading ? (
          <div className={style.loading}>{t('loading')}</div>
        ) : photos.length === 0 ? (
          <div className={style.empty}>
            <p>{t('empty')}</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={photos}
            rowKey={(photo) => photo.id}
          />
        )}
      </div>
    </div>
  )
}
