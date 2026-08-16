'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { createClient } from '@/app/lib/supabase/client'
import { getPhotosForAdmin } from '@/app/lib/supabase/photos'
import { groupByYear } from '@/app/lib/photos/group'
import {
  applyPhotoFilters,
  countPhotoFilters,
  type PhotoFilterKey,
} from '@/app/lib/photos/adminFilters'
import { useIsDesktop } from '@/app/lib/hooks/useIsDesktop'
import type { Photo } from '@/app/types/photo'
import type { SupportedLocale } from '@/app/types/blog'
import Button from '@/app/components/admin/Button/Button'
import Modal from '@/app/components/admin/Modal/Modal'
import { useToast } from '@/app/components/admin/Toast/ToastProvider'
import { photoCaption } from '@/app/lib/photos/format'
import ContactSheet from '@/app/components/admin/PhotoSheet/ContactSheet'
import FilterChips from '@/app/components/admin/PhotoSheet/FilterChips'
import PhotoInspector from '@/app/components/admin/PhotoSheet/PhotoInspector'
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
  const router = useRouter()
  const isDesktop = useIsDesktop()

  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilters, setActiveFilters] = useState<Set<PhotoFilterKey>>(
    new Set()
  )
  const [mobileModalOpen, setMobileModalOpen] = useState(false)

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
    () => [...photos].sort((a, b) => (a.takenAtLocal < b.takenAtLocal ? 1 : -1)),
    [photos]
  )
  const counts = useMemo(() => countPhotoFilters(sorted), [sorted])
  const filtered = useMemo(
    () => applyPhotoFilters(sorted, activeFilters),
    [sorted, activeFilters]
  )
  const groups = useMemo(() => groupByYear(filtered), [filtered])

  const { selectedId, select, moveBy, handleKeyDown } = usePhotoSelection(filtered)
  const selectedPhoto = filtered.find((p) => p.id === selectedId) ?? null

  const toggleFilter = (key: PhotoFilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleSelect = (id: string) => {
    select(id)
    if (!isDesktop) setMobileModalOpen(true)
  }

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
          <Button onClick={() => router.push('/admin/photos/upload')}>
            {t('upload.cta')}
          </Button>
        </div>

        {photos.length > 0 && (
          <FilterChips
            counts={counts}
            active={activeFilters}
            onToggle={toggleFilter}
            onClear={() => setActiveFilters(new Set())}
          />
        )}

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
                onSelect={handleSelect}
                onKeyDown={handleKeyDown}
              />
            </div>

            {isDesktop && selectedPhoto && (
              <aside className={style.inspectorPane}>
                <PhotoInspector
                  photo={selectedPhoto}
                  locale={locale}
                  onPrev={() => moveBy(-1)}
                  onNext={() => moveBy(1)}
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
        >
          <PhotoInspector
            photo={selectedPhoto}
            locale={locale}
            onPrev={() => moveBy(-1)}
            onNext={() => moveBy(1)}
          />
        </Modal>
      )}
    </div>
  )
}
