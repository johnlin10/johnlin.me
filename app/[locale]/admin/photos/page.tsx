'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { createClient } from '@/app/lib/supabase/client'
import { useSearchParamState } from '@/app/lib/hooks/useSearchParamState'
import {
  getPhotosForAdmin,
  updatePhotosStatus,
} from '@/app/lib/supabase/photos'
import { groupByYear } from '@/app/lib/photos/group'
import {
  applyPhotoFilters,
  countPhotoFilters,
  isPhotoFilterKey,
  PHOTO_FILTER_KEYS,
  type PhotoFilterKey,
} from '@/app/lib/photos/adminFilters'
import { useIsDesktop } from '@/app/lib/hooks/useIsDesktop'
import type { Photo, PhotoStatus } from '@/app/types/photo'
import type { SupportedLocale } from '@/app/types/blog'
import Button from '@/app/components/admin/Button/Button'
import PageHeader from '@/app/components/admin/PageHeader/PageHeader'
import Modal from '@/app/components/admin/Modal/Modal'
import { useToast } from '@/app/components/admin/Toast/ToastProvider'
import { useConfirm } from '@/app/components/admin/ConfirmDialog/ConfirmDialog'
import { photoCaption } from '@/app/lib/photos/format'
import ContactSheet from '@/app/components/admin/PhotoSheet/ContactSheet'
import FilterChips from '@/app/components/admin/PhotoSheet/FilterChips'
import PhotoInspector from '@/app/components/admin/PhotoSheet/PhotoInspector'
import BulkActionBar from '@/app/components/admin/PhotoSheet/BulkActionBar'
import OrphanReport from '@/app/components/admin/PhotoSheet/OrphanReport'
import { usePhotoSelection } from '@/app/components/admin/PhotoSheet/usePhotoSelection'
import style from './photos.module.scss'

/**
 * 攝影管理：印象表（唯讀）＋ 檢閱欄。
 *
 * 桌機雙欄，檢閱欄固定在右側；平板／手機沒有側欄空間，點縮圖改用 Modal
 * 開檢閱欄。表格視圖留給之後的批次操作用（見規劃 Phase 7），這裡先专注在
 * 「一眼看出哪些還沒弄完」——所以主要互動是篩選 chips，不是排序或搜尋。
 */
export default function AdminPhotosPage() {
  const t = useTranslations('AdminPage.photos')
  const locale = useLocale() as SupportedLocale
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  const confirm = useConfirm()
  const router = useRouter()
  const isDesktop = useIsDesktop()

  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  // 篩選條件放在網址上，重整後不會被打回未篩選。不認得的 key 直接丟掉
  // ——網址是使用者打得出來的輸入。
  const [filterParam, setFilterParam] = useSearchParamState('filter')
  const activeFilters = useMemo(
    () =>
      new Set(
        (filterParam?.split(',') ?? []).filter((key) => isPhotoFilterKey(key)),
      ),
    [filterParam],
  )
  // 依 PHOTO_FILTER_KEYS 的固定順序序列化：同一組條件不會因為點選順序不同
  // 而產生兩種網址。
  const setActiveFilters = (next: ReadonlySet<PhotoFilterKey>) =>
    setFilterParam(PHOTO_FILTER_KEYS.filter((key) => next.has(key)).join(','))
  const [mobileModalOpen, setMobileModalOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [orphansOpen, setOrphansOpen] = useState(false)

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

  // getPhotosForAdmin 依 taken_at（瞬間）排序，但年份分組讀的是 takenAtLocal
  // （牆鐘時間）。時區跨日的照片兩者可能不一致，讓同一年被拆成兩組
  // ——印象表先依 takenAtLocal 重排，跟前台掛畫帶的分組依據一致。
  const sorted = useMemo(
    () =>
      [...photos].sort((a, b) => (a.takenAtLocal < b.takenAtLocal ? 1 : -1)),
    [photos],
  )
  const counts = useMemo(() => countPhotoFilters(sorted), [sorted])
  const filtered = useMemo(
    () => applyPhotoFilters(sorted, activeFilters),
    [sorted, activeFilters],
  )
  const groups = useMemo(() => groupByYear(filtered), [filtered])

  const {
    selectedId,
    select,
    moveBy,
    checkedIds,
    toggleChecked,
    clearChecked,
    handleKeyDown,
  } = usePhotoSelection(filtered)
  const selectedPhoto = filtered.find((p) => p.id === selectedId) ?? null

  const toggleFilter = (key: PhotoFilterKey) => {
    const next = new Set(activeFilters)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setActiveFilters(next)
  }

  const handleSelect = (id: string) => {
    select(id)
    if (!isDesktop) setMobileModalOpen(true)
  }

  // 檢閱欄自己存進 DB 之後回報上來，讓縮圖角標／篩選計數／年份分組立刻反映
  // 最新內容，不必整頁重新 load()。
  const handlePatched = (id: string, patch: Partial<Photo>) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  const handleDeleted = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id))
    setMobileModalOpen(false)
  }

  const bulkStatus = async (next: PhotoStatus) => {
    const ids = [...checkedIds]
    if (ids.length === 0) return
    setBulkBusy(true)
    try {
      await updatePhotosStatus(supabase, ids, next)
      setPhotos((prev) =>
        prev.map((p) => (checkedIds.has(p.id) ? { ...p, status: next } : p)),
      )
      await fetch('/api/admin/photos/revalidate', { method: 'POST' }).catch(
        () => {},
      )
      clearChecked()
      toast.success(t('bulk.statusSuccess', { count: ids.length }))
    } catch {
      toast.error(t('bulk.statusError'))
    } finally {
      setBulkBusy(false)
    }
  }

  const bulkDelete = async () => {
    const ids = [...checkedIds]
    if (ids.length === 0) return
    const ok = await confirm({
      title: t('bulk.deleteConfirmTitle', { count: ids.length }),
      message: t('bulk.deleteConfirmMessage', { count: ids.length }),
      danger: true,
    })
    if (!ok) return

    setBulkBusy(true)
    try {
      // 逐張走 DELETE 路由而不是一次 deletePhotos()：R2 的清理是逐個前綴的，
      // 只刪資料列會讓每一張都變成孤兒，得再跑一次盤點才清得掉。
      const results = await Promise.allSettled(
        ids.map((id) => fetch(`/api/admin/photos/${id}`, { method: 'DELETE' })),
      )
      const failed = results.filter(
        (r) => r.status === 'rejected' || !r.value.ok,
      ).length
      const deleted = ids.filter((_, i) => {
        const r = results[i]
        return r.status === 'fulfilled' && r.value.ok
      })
      setPhotos((prev) => prev.filter((p) => !deleted.includes(p.id)))
      clearChecked()
      if (failed > 0)
        toast.error(t('bulk.deletePartialError', { count: failed }))
      else toast.success(t('bulk.deleteSuccess', { count: deleted.length }))
    } catch {
      toast.error(t('bulk.deleteError'))
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className={style.photos_page}>
      <div className={style.container}>
        <PageHeader
          title={t('heading')}
          subtitle={
            <>
              {t('count.total')}
              {photos.length}
              {t('count.unit')}
            </>
          }
          action={
            <Button onClick={() => router.push('/photos/upload')}>
              {t('upload.cta')}
            </Button>
          }
          subbar={
            photos.length > 0 ? (
              <FilterChips
                counts={counts}
                active={activeFilters}
                onToggle={toggleFilter}
                onClear={() => setActiveFilters(new Set())}
              />
            ) : undefined
          }
        />

        {/* 次要功能按鈕：頂部控制欄只放一顆主要操作，這顆放內容區頂部 */}
        <div className={style.contentActions}>
          <Button variant="ghost" onClick={() => setOrphansOpen(true)}>
            {t('orphans.cta')}
          </Button>
        </div>

        <BulkActionBar
          count={checkedIds.size}
          busy={bulkBusy}
          onPublish={() => void bulkStatus('published')}
          onUnpublish={() => void bulkStatus('draft')}
          onDelete={() => void bulkDelete()}
          onClear={clearChecked}
        />

        {loading ? (
          <div className={style.loading}>{t('loading')}</div>
        ) : photos.length === 0 ? (
          <div className={style.empty}>
            <p>{t('empty')}</p>
          </div>
        ) : (
          <div className={style.layout}>
            <div className={style.sheetPane}>
              <ContactSheet
                groups={groups}
                locale={locale}
                selectedId={selectedId}
                checkedIds={checkedIds}
                onSelect={handleSelect}
                onToggleChecked={toggleChecked}
                onKeyDown={handleKeyDown}
              />
            </div>

            {isDesktop && selectedPhoto && (
              <aside className={style.inspectorPane}>
                {/* key：換照片整顆重掛載，見 PhotoInspector 檔案頂端註解。 */}
                <PhotoInspector
                  key={selectedPhoto.id}
                  photo={selectedPhoto}
                  locale={locale}
                  onPrev={() => moveBy(-1)}
                  onNext={() => moveBy(1)}
                  onPatched={handlePatched}
                  onDeleted={handleDeleted}
                />
              </aside>
            )}
          </div>
        )}
      </div>

      {!isDesktop && selectedPhoto && (
        <Modal
          isOpen={mobileModalOpen}
          onClose={() => setMobileModalOpen(false)}
          title={photoCaption(selectedPhoto, locale) ?? selectedPhoto.slug}
          size="large"
          // PhotoInspector 自帶內距，Modal 不要再疊一層
          bodyPadding={false}
        >
          <PhotoInspector
            key={selectedPhoto.id}
            photo={selectedPhoto}
            locale={locale}
            onPrev={() => moveBy(-1)}
            onNext={() => moveBy(1)}
            onPatched={handlePatched}
            onDeleted={handleDeleted}
          />
        </Modal>
      )}

      <OrphanReport
        isOpen={orphansOpen}
        onClose={() => setOrphansOpen(false)}
        onCleaned={load}
      />
    </div>
  )
}
