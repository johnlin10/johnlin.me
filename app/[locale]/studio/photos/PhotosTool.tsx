'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
import type { Photo, PhotoStatus } from '@/app/types/photo'
import type { SupportedLocale } from '@/app/types/blog'
import Button from '@/app/components/admin/Button/Button'
import PageHeader from '@/app/components/admin/PageHeader/PageHeader'
import { useToast } from '@/app/components/admin/Toast/ToastProvider'
import { useConfirm } from '@/app/components/admin/ConfirmDialog/ConfirmDialog'
import ContactSheet from '@/app/components/admin/PhotoSheet/ContactSheet'
import FilterChips from '@/app/components/admin/PhotoSheet/FilterChips'
import PhotoInspector from '@/app/components/admin/PhotoSheet/PhotoInspector'
import Filmstrip from '@/app/components/admin/PhotoEditLayout/Filmstrip'
import BulkActionBar from '@/app/components/admin/PhotoSheet/BulkActionBar'
import OrphanReport from '@/app/components/admin/PhotoSheet/OrphanReport'
import { usePhotoSelection } from '@/app/components/admin/PhotoSheet/usePhotoSelection'
import style from './photos.module.scss'

/**
 * 攝影管理：全寬的印象表 ＋ 單張檢視。
 *
 * 印象表負責瀏覽、篩選和批次操作；點一張就進單張檢視（網址帶 ?photo=slug，
 * 重整或按上一頁都回得來），底部縮圖列只放目前篩出來的照片，篩選完就是
 * 一份待辦清單。主要互動是篩選 chips，不是排序或搜尋——日常要找的是
 * 「哪些還沒弄完」。
 */
export default function PhotosTool({ initial }: { initial: Photo[] | null }) {
  const t = useTranslations('AdminPage.photos')
  const locale = useLocale() as SupportedLocale
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  const confirm = useConfirm()
  const router = useRouter()

  const [photos, setPhotos] = useState<Photo[]>(initial ?? [])
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
  const [photoParam, setPhotoParam] = useSearchParamState('photo')
  // 單張檢視以 id 為準，網址的 slug 只負責重整／上一頁：改 slug 自動存檔
  // 的那一瞬間，photos 已經是新 slug、網址還是舊的，拿 slug 當事實來源
  // 會讓單張檢視以為照片不見了而關掉。
  const [focusId, setFocusId] = useState<string | null>(
    () => (initial ?? []).find((p) => p.slug === photoParam)?.id ?? null,
  )
  // 這次打開單張時有沒有推一筆歷程；有的話「返回」走 history.back()，
  // 不然歷程裡會多一筆重複的印象表。
  const pushedRef = useRef(false)
  const [editLocale, setEditLocale] = useState<SupportedLocale>('zh-tw')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [orphansOpen, setOrphansOpen] = useState(false)

  const load = async () => {
    try {
      setPhotos(await getPhotosForAdmin(supabase))
    } catch {
      toast.error(t('loadError'))
    }
  }

  // 首屏資料由 page.tsx 在伺服器端抓好帶進來
  useEffect(() => {
    if (!initial) toast.error(t('loadError'))
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
    checkedIds,
    toggleChecked,
    clearChecked,
    handleKeyDown,
  } = usePhotoSelection(filtered)

  const toggleFilter = (key: PhotoFilterKey) => {
    const next = new Set(activeFilters)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setActiveFilters(next)
  }

  // 上一頁／下一頁換了網址：跟著開關單張。找不到這個 slug 就不動——
  // 可能是剛改完 slug、網址還沒跟上。
  useEffect(() => {
    if (!photoParam) {
      setFocusId(null)
      return
    }
    const match = photos.find((p) => p.slug === photoParam)
    if (match) setFocusId(match.id)
  }, [photoParam, photos])

  const focusPhoto = photos.find((p) => p.id === focusId) ?? null

  // 單張的縮圖列 = 目前篩出來的照片。正在看的這張就算剛補完、已經不符合
  // 篩選條件也要留著，不然補完英文說明的當下它就從清單裡消失了；換到下一張
  // 之後它才會退出清單。
  const queue = useMemo(() => {
    if (!focusPhoto) return []
    const visible = new Set(filtered.map((p) => p.id))
    return sorted.filter((p) => visible.has(p.id) || p.id === focusPhoto.id)
  }, [focusPhoto, filtered, sorted])
  const focusIndex = queue.findIndex((p) => p.id === focusId)

  const openFocus = (id: string) => {
    const photo = photos.find((p) => p.id === id)
    if (!photo) return
    select(id)
    setFocusId(id)
    pushedRef.current = true
    setPhotoParam(photo.slug, { push: true })
    window.scrollTo(0, 0)
  }

  const moveFocus = (id: string) => {
    const photo = photos.find((p) => p.id === id)
    if (!photo) return
    select(id)
    setFocusId(id)
    setPhotoParam(photo.slug)
  }

  const closeFocus = () => {
    if (pushedRef.current) {
      pushedRef.current = false
      window.history.back()
      return
    }
    setFocusId(null)
    setPhotoParam(null)
  }

  // 單張的鍵盤：Esc 回印象表、←／→ 換張。焦點在輸入框、下拉選單或對話框
  // 裡時不攔，不然打字移游標或關選單都會跳照片。
  useEffect(() => {
    if (!focusId) return
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      const target = e.target
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          target.closest('[role="listbox"], [role="dialog"]'))
      ) {
        return
      }
      if (e.key === 'Escape') closeFocus()
      else if (e.key === 'ArrowLeft' && queue[focusIndex - 1]) moveFocus(queue[focusIndex - 1].id)
      else if (e.key === 'ArrowRight' && queue[focusIndex + 1]) moveFocus(queue[focusIndex + 1].id)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  // 單張自己存進 DB 之後回報上來，讓縮圖角標／篩選計數／年份分組立刻反映
  // 最新內容，不必整頁重新 load()。
  const handlePatched = (id: string, patch: Partial<Photo>) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
    if (id === focusId && patch.slug) setPhotoParam(patch.slug)
  }

  // 刪掉正在看的那張：換到清單裡的下一張，沒有了才回印象表。
  const handleDeleted = (id: string) => {
    const index = queue.findIndex((p) => p.id === id)
    const neighbor = queue[index + 1] ?? queue[index - 1]
    setPhotos((prev) => prev.filter((p) => p.id !== id))
    if (id !== focusId) return
    if (neighbor) moveFocus(neighbor.id)
    else closeFocus()
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

  if (focusPhoto) {
    return (
      <div className={style.photos_page}>
        {/* key：換照片整顆重掛載，見 PhotoInspector 檔案頂端註解。 */}
        <PhotoInspector
          key={focusPhoto.id}
          photo={focusPhoto}
          editLocale={editLocale}
          onEditLocaleChange={setEditLocale}
          onPatched={handlePatched}
          onDeleted={handleDeleted}
          back={{ onClick: closeFocus, label: t('upload.back') }}
          subtitle={t('upload.stepOf', { current: focusIndex + 1, total: queue.length })}
          filmstrip={
            <Filmstrip
              items={queue.map((p, i) => ({
                id: p.id,
                src: p.derivatives[0]?.url ?? '',
                label: t('upload.stepOf', { current: i + 1, total: queue.length }),
              }))}
              currentId={focusPhoto.id}
              onSelect={moveFocus}
            />
          }
          onPrev={focusIndex > 0 ? () => moveFocus(queue[focusIndex - 1].id) : undefined}
          onNext={
            focusIndex < queue.length - 1
              ? () => moveFocus(queue[focusIndex + 1].id)
              : undefined
          }
        />
      </div>
    )
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

        {photos.length === 0 ? (
          <div className={style.empty}>
            <p>{t('empty')}</p>
          </div>
        ) : (
          <ContactSheet
            groups={groups}
            locale={locale}
            selectedId={selectedId}
            checkedIds={checkedIds}
            onSelect={openFocus}
            onToggleChecked={toggleChecked}
            onKeyDown={handleKeyDown}
          />
        )}
      </div>

      <OrphanReport
        isOpen={orphansOpen}
        onClose={() => setOrphansOpen(false)}
        onCleaned={load}
      />
    </div>
  )
}
