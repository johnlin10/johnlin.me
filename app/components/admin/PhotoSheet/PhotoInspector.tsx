'use client'

import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/app/lib/supabase/client'
import { updatePhoto } from '@/app/lib/supabase/photos'
import { isUniqueViolation } from '@/app/lib/supabase/errors'
import { isValidPhotoSlug } from '@/app/lib/photos/slug'
import { buildPhotoLocales } from '@/app/lib/photos/localeFields'
import { useAutosave } from '@/app/lib/hooks/useAutosave'
import { useToast } from '@/app/components/admin/Toast/ToastProvider'
import { useConfirm } from '@/app/components/admin/ConfirmDialog/ConfirmDialog'
import type {
  Photo,
  PhotoStatus,
  PhotoTakenAtPrecision,
  UpdatePhotoInput,
} from '@/app/types/photo'
import type { SupportedLocale } from '@/app/types/blog'
import PhotoMeta from '@/app/components/gallery/PhotoMeta/PhotoMeta'
import PageHeader from '@/app/components/admin/PageHeader/PageHeader'
import { formatTakenAt, photoCaption, photoLocationName } from '@/app/lib/photos/format'
import Icon from '@/app/components/Icon/Icon'
import Button from '@/app/components/admin/Button/Button'
import Input from '@/app/components/admin/Input/Input'
import DropdownSelect from '@/app/components/admin/Selector/DropdownSelect'
import SaveIndicator from '@/app/components/admin/SaveIndicator/SaveIndicator'
import LocaleToggle from '@/app/components/admin/LocaleToggle/LocaleToggle'
import PhotoEditLayout from '@/app/components/admin/PhotoEditLayout/PhotoEditLayout'
import style from './PhotoSheet.module.scss'

interface PhotoInspectorProps {
  photo: Photo
  /** 正在編輯、也是預覽顯示的語言。放在呼叫端：換下一張時不該被重設回中文。 */
  editLocale: SupportedLocale
  onEditLocaleChange: (locale: SupportedLocale) => void
  /** 頂部控制欄：返回印象表、「第幾張，共幾張」。 */
  back: { onClick: () => void; label: string }
  subtitle: string
  /** 底部列：縮圖列與上一張／下一張，由呼叫端決定範圍。 */
  filmstrip: ReactNode
  onPrev?: () => void
  onNext?: () => void
  /** 把已經存進資料庫的變更也反映回印象表（縮圖角標、篩選計數、年份分組）。 */
  onPatched: (id: string, patch: Partial<Photo>) => void
  onDeleted: (id: string) => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// 跟 DB 的 photos_taken_at_local_format_check 同一條。
const TAKEN_AT_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/

/**
 * DB 沒有另外存拍攝當下的時區位移——taken_at（絕對時間）與 taken_at_local
 * （牆鐘字串）兩個既有欄位的差就是它。編輯 takenAtLocal 時回推這個位移，
 * 套用到新值上，沿用原本記錄的時區而不是憑空假設 +08:00。
 */
function deriveTakenAt(nextLocal: string, prevLocal: string, prevTakenAt: string): string {
  const offsetMs = Date.parse(`${prevLocal}Z`) - Date.parse(prevTakenAt)
  return new Date(Date.parse(`${nextLocal}Z`) - offsetMs).toISOString()
}

type PhotoPatch = Omit<UpdatePhotoInput, 'id'>

/** patch 轉成可以直接疊回 Photo 的形狀，逐欄位轉換而不是整包 spread——
 * location／exif 在 UpdatePhotoInput 允許 null 清空，Photo 上沒有 null 這個狀態。 */
function toPhotoPatch(patch: PhotoPatch): Partial<Photo> {
  const result: Partial<Photo> = {}
  if (patch.slug !== undefined) result.slug = patch.slug
  if (patch.takenAt !== undefined) result.takenAt = patch.takenAt
  if (patch.takenAtLocal !== undefined) result.takenAtLocal = patch.takenAtLocal
  if (patch.takenAtPrecision !== undefined) result.takenAtPrecision = patch.takenAtPrecision
  if (patch.locales !== undefined) result.locales = patch.locales
  if (patch.status !== undefined) result.status = patch.status
  if ('location' in patch) result.location = patch.location ?? undefined
  if ('exif' in patch) result.exif = patch.exif ?? undefined
  return result
}

/**
 * 照片頁的單張檢視：照片放大在左，下面是前台會看到的說明，即時反映草稿
 * 內容——「後台看到的就是訪客會看到的」。右欄是欄位，只有尺寸／檔案大小
 * 是真的唯讀（上傳後不再變動，見 UpdatePhotoInput 的設計），其餘都接了
 * 自動存檔；發布與刪除放在右欄最下面。
 *
 * key={photo.id} 由呼叫端負責：換照片時整顆重掛載，草稿狀態才不會把
 * 上一張的編輯內容帶到下一張。useAutosave 既有的 unmount flush 因此
 * 順便保證了「切照片前把還沒存的內容存掉」，不需要另外處理。
 */
export default function PhotoInspector({
  photo,
  editLocale,
  onEditLocaleChange,
  back,
  subtitle,
  filmstrip,
  onPrev,
  onNext,
  onPatched,
  onDeleted,
}: PhotoInspectorProps) {
  const t = useTranslations('AdminPage.photos.inspector')
  const tStatus = useTranslations('AdminPage.photos.status')
  const tFields = useTranslations('AdminPage.photos.fields')
  const uiLocale = useLocale() as SupportedLocale
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  const confirm = useConfirm()

  const preview =
    photo.derivatives.findLast((d) => d.w <= 1600) ?? photo.derivatives.at(-1)

  const [slug, setSlug] = useState(photo.slug)
  const [slugError, setSlugError] = useState<string | undefined>()
  // 上一次成功存進 DB 的 slug；撞號時退回這個值，而不是掛載當下的初始值——
  // 這次 session 裡如果已經成功改過一次，不該把那次成功的編輯也撤銷掉。
  const lastGoodSlugRef = useRef(photo.slug)

  const [captionZh, setCaptionZh] = useState(photo.locales['zh-tw']?.caption ?? '')
  const [captionEn, setCaptionEn] = useState(photo.locales.en?.caption ?? '')
  const [locationNameZh, setLocationNameZh] = useState(
    photo.locales['zh-tw']?.locationName ?? ''
  )
  const [locationNameEn, setLocationNameEn] = useState(
    photo.locales.en?.locationName ?? ''
  )

  const [takenAtLocal, setTakenAtLocal] = useState(photo.takenAtLocal)
  const [takenAtLocalError, setTakenAtLocalError] = useState<string | undefined>()
  const [takenAtPrecision, setTakenAtPrecision] = useState(photo.takenAtPrecision)

  const [includeGps, setIncludeGps] = useState(photo.location !== undefined)

  const [status, setStatus] = useState(photo.status)
  const [statusSaving, setStatusSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editingSlug, setEditingSlug] = useState(false)

  const autosave = useAutosave<PhotoPatch>({
    save: async (patch) => {
      try {
        await updatePhoto(supabase, { ...patch, id: photo.id })
        onPatched(photo.id, toPhotoPatch(patch))
        if (patch.slug !== undefined) lastGoodSlugRef.current = patch.slug
      } catch (error) {
        // slug 撞號整包 UPDATE 會一起失敗，撞號的只有 slug 一個欄位，
        // 拆開重送其餘欄位，不能讓一個 23505 把這批的其他修改也吞掉。
        if (isUniqueViolation(error) && patch.slug !== undefined) {
          setSlug(lastGoodSlugRef.current)
          setSlugError(t('slugTaken'))
          const rest = { ...patch }
          delete rest.slug
          if (Object.keys(rest).length > 0) {
            await updatePhoto(supabase, { ...rest, id: photo.id })
            onPatched(photo.id, toPhotoPatch(rest))
          }
          return
        }
        throw error
      }
    },
  })

  const handleSlugChange = (value: string) => {
    setSlug(value)
    if (!isValidPhotoSlug(value)) {
      setSlugError(t('invalidSlug'))
      return
    }
    setSlugError(undefined)
    autosave.schedule({ slug: value })
  }

  const scheduleLocales = (fields: {
    captionZh: string
    captionEn: string
    locationNameZh: string
    locationNameEn: string
  }) => {
    autosave.schedule({ locales: buildPhotoLocales(fields) })
  }

  const handleCaptionChange = (value: string) => {
    if (editLocale === 'zh-tw') {
      setCaptionZh(value)
      scheduleLocales({
        captionZh: value,
        captionEn,
        locationNameZh,
        locationNameEn,
      })
    } else {
      setCaptionEn(value)
      scheduleLocales({
        captionZh,
        captionEn: value,
        locationNameZh,
        locationNameEn,
      })
    }
  }

  const handleLocationNameChange = (value: string) => {
    if (editLocale === 'zh-tw') {
      setLocationNameZh(value)
      scheduleLocales({
        captionZh,
        captionEn,
        locationNameZh: value,
        locationNameEn,
      })
    } else {
      setLocationNameEn(value)
      scheduleLocales({
        captionZh,
        captionEn,
        locationNameZh,
        locationNameEn: value,
      })
    }
  }

  const handleTakenAtLocalChange = (value: string) => {
    setTakenAtLocal(value)
    if (!TAKEN_AT_LOCAL_PATTERN.test(value)) {
      setTakenAtLocalError(tFields('datePlaceholder'))
      return
    }
    setTakenAtLocalError(undefined)
    const takenAt = deriveTakenAt(value, photo.takenAtLocal, photo.takenAt)
    autosave.schedule({ takenAtLocal: value, takenAt })
  }

  const handlePrecisionChange = (value: string) => {
    const precision = value as PhotoTakenAtPrecision
    setTakenAtPrecision(precision)
    autosave.schedule({ takenAtPrecision: precision })
  }

  const handleGpsToggle = (checked: boolean) => {
    setIncludeGps(checked)
    // 只能關閉、不能開啟：完整精度的原始座標在上傳後就不會再存在瀏覽器裡，
    // 這裡的 photo.location 已經是四捨五入過的值，重新勾選只是還原
    // 「這次 session 裡曾經關掉」，不是重新採座標。
    autosave.schedule({ location: checked ? (photo.location ?? null) : null })
  }

  const toggleStatus = async () => {
    const next: PhotoStatus = status === 'published' ? 'draft' : 'published'
    setStatusSaving(true)
    try {
      // 發布前先把還沒送出的欄位存掉，發布出去的才是使用者剛剛打的最新內容。
      await autosave.flush()
      await updatePhoto(supabase, { id: photo.id, status: next })
      setStatus(next)
      onPatched(photo.id, { status: next })
      await fetch('/api/admin/photos/revalidate', { method: 'POST' }).catch(() => {})
      toast.success(next === 'published' ? t('publishSuccess') : t('unpublishSuccess'))
    } catch {
      toast.error(t('statusError'))
    } finally {
      setStatusSaving(false)
    }
  }

  const handleDelete = async () => {
    const ok = await confirm({
      title: t('deleteConfirmTitle'),
      message: t('deleteConfirmMessage', {
        name: captionZh.trim() || captionEn.trim() || slug,
      }),
      danger: true,
    })
    if (!ok) return

    setDeleting(true)
    try {
      // 已排程但還沒送出的編輯要丟掉，不然 unmount flush 會對著一筆
      // 已經被刪掉的 row 發 UPDATE。
      autosave.markClean()
      const res = await fetch(`/api/admin/photos/${photo.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error(json.error ?? t('deleteError'))
        return
      }
      toast.success(t('deleteSuccess'))
      onDeleted(photo.id)
    } catch {
      toast.error(t('deleteError'))
    } finally {
      setDeleting(false)
    }
  }

  // 即時預覽用的草稿快照：上半的 PhotoMeta 吃這個，不是 photo prop ——
  // 打字的當下就要看到前台會顯示的樣子，不必等 autosave 真的送出。
  const draftAsPhoto: Photo = {
    ...photo,
    slug,
    takenAtLocal,
    takenAtPrecision,
    locales: buildPhotoLocales({
      captionZh,
      captionEn,
      locationNameZh,
      locationNameEn,
    }),
    location: includeGps ? photo.location : undefined,
  }

  const precisionOptions: { value: PhotoTakenAtPrecision; label: string }[] = [
    { value: 'day', label: tFields('precisionDay') },
    { value: 'month', label: tFields('precisionMonth') },
    { value: 'year', label: tFields('precisionYear') },
  ]

  // 標題跟前台單張頁同一套退回順序：說明 → 地名 → 日期。用介面語言，
  // 不跟著編輯語言切換——標題是用來認照片的，不是預覽。
  const title =
    photoCaption(draftAsPhoto, uiLocale) ||
    photoLocationName(draftAsPhoto, uiLocale) ||
    formatTakenAt(takenAtLocal, takenAtPrecision, uiLocale) ||
    slug

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        back={back}
        action={
          <div className={style.statusAction}>
            <span
              className={`${style.statusLabel} ${status === 'published' ? style.statusPublished : style.statusDraft}`}
            >
              <Icon name={status === 'published' ? 'eye' : 'eye-slash'} size="xs" />
              {tStatus(status)}
            </span>
            <Button
              variant={status === 'published' ? 'secondary' : 'primary'}
              onClick={() => void toggleStatus()}
              disabled={statusSaving}
            >
              {status === 'published' ? t('unpublish') : t('publish')}
            </Button>
          </div>
        }
      />
      <PhotoEditLayout
        src={preview?.url ?? ''}
        width={photo.width}
        height={photo.height}
        placeholder={photo.blurDataUrl}
        hdrSrc={photo.isHdr ? photo.urlOriginal : undefined}
        isHdr={photo.isHdr}
        meta={<PhotoMeta photo={draftAsPhoto} locale={editLocale} as="div" />}
        filmstrip={filmstrip}
        onPrev={onPrev}
        onNext={onNext}
        panel={
          <>
            <div className={style.panelTop}>
              <LocaleToggle
                value={editLocale}
                onChange={onEditLocaleChange}
                filled={{
                  'zh-tw': Boolean(captionZh.trim() || locationNameZh.trim()),
                  en: Boolean(captionEn.trim() || locationNameEn.trim()),
                }}
              />
              <SaveIndicator
                state={autosave.state}
                lastSavedAt={autosave.lastSavedAt}
                onRetry={autosave.retry}
              />
            </div>

            <Input
              label={tFields('caption')}
              value={editLocale === 'zh-tw' ? captionZh : captionEn}
              onChange={handleCaptionChange}
              compact
            />
            <Input
              label={tFields('locationName')}
              value={editLocale === 'zh-tw' ? locationNameZh : locationNameEn}
              onChange={handleLocationNameChange}
              compact
            />

            <div className={style.inspectorDateRow}>
              <Input
                label={tFields('date')}
                value={takenAtLocal}
                onChange={handleTakenAtLocalChange}
                placeholder={tFields('datePlaceholder')}
                error={takenAtLocalError}
                compact
              />
              <DropdownSelect
                value={takenAtPrecision}
                onChange={handlePrecisionChange}
                options={precisionOptions}
                placeholder={tFields('precisionDay')}
                clearable={false}
                compact
              />
            </div>

            {photo.location && (
              <label className={style.gpsRow}>
                <input
                  type="checkbox"
                  checked={includeGps}
                  onChange={(e) => handleGpsToggle(e.target.checked)}
                />
                <span>{tFields('includeGps')}</span>
                {includeGps && (
                  <span className={style.gpsPublicNote}>
                    {photo.location.lat}, {photo.location.lng}
                  </span>
                )}
              </label>
            )}

            {(editingSlug || slugError) && (
              <Input
                label={t('slug')}
                value={slug}
                onChange={handleSlugChange}
                error={slugError}
                compact
              />
            )}

            <dl className={style.inspectorFacts}>
              {!editingSlug && !slugError && (
                <div className={style.factRow}>
                  <dt>{tFields('url')}</dt>
                  <dd>
                    <span className={style.slugText}>/photography/{slug}</span>
                    <button
                      type="button"
                      className={style.textAction}
                      onClick={() => setEditingSlug(true)}
                    >
                      {tFields('editSlug')}
                    </button>
                  </dd>
                </div>
              )}
              <div className={style.factRow}>
                <dt>{t('dimensions')}</dt>
                <dd>
                  {photo.width} × {photo.height}
                  {photo.isHdr && <span className={style.hdrTag}>HDR</span>}
                </dd>
              </div>
              <div className={style.factRow}>
                <dt>{t('fileSize')}</dt>
                <dd>{formatBytes(photo.originalBytes)}</dd>
              </div>
            </dl>

            <div className={style.dangerZone}>
              {status === 'published' && (
                <Link
                  href={`/photography/${slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={style.openOnSite}
                >
                  <Icon name="arrow-right" size="xs" />
                  {t('openOnSite')}
                </Link>
              )}
              <Button
                variant="danger"
                size="small"
                onClick={() => void handleDelete()}
                disabled={deleting}
              >
                <Icon name="trash" size="xs" />
                {t('delete')}
              </Button>
            </div>
          </>
        }
      />
    </>
  )
}
