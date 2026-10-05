'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/app/lib/supabase/client'
import PageHeader from '@/app/components/admin/PageHeader/PageHeader'
import { getTakenSlugs } from '@/app/lib/supabase/photos'
import {
  ensureUniquePhotoSlug,
  isValidPhotoSlug,
  makePhotoSlugBase,
} from '@/app/lib/photos/slug'
import { isSupportedPhotoMime } from '@/app/lib/photos/mime'
import { readImageSize } from '@/app/lib/images/dimensions'
import {
  fallbackTakenAtLocal,
  normalizeTakenAtLocal,
  readExifDraft,
  toTakenAt,
} from '@/app/lib/photos/exifDraft'
import type { SupportedLocale } from '@/app/types/blog'
import Button from '@/app/components/admin/Button/Button'
import Icon from '@/app/components/Icon/Icon'
import DropZone from '@/app/components/admin/PhotoUpload/DropZone'
import Filmstrip from '@/app/components/admin/PhotoEditLayout/Filmstrip'
import StagedPhotoEditor from '@/app/components/admin/PhotoUpload/StagedPhotoEditor'
import UploadReview from '@/app/components/admin/PhotoUpload/UploadReview'
import { useUploadQueue } from '@/app/components/admin/PhotoUpload/useUploadQueue'
import type { StagedPhoto } from '@/app/components/admin/PhotoUpload/stagedPhoto'
import style from './upload.module.scss'

interface RejectedFile {
  name: string
}

/**
 * 上傳預檢表：拖進檔案 → 瀏覽器解 EXIF → 一張一張確認欄位 → 檢查清單
 * → 才送出第一個位元組。
 *
 * 獨立路由而不是 modal：預檢表需要整頁寬度來排欄位，而且上傳到一半誤觸
 * 上一頁是很致命的操作，獨立路由至少讓瀏覽器的離開確認機制幫得上忙。
 */
export default function PhotoUploadPage() {
  const t = useTranslations('AdminPage.photos.upload')
  const supabase = useMemo(() => createClient(), [])
  const [photos, setPhotos] = useState<StagedPhoto[]>([])
  const [rejected, setRejected] = useState<RejectedFile[]>([])
  const [currentId, setCurrentId] = useState('')
  const [step, setStep] = useState<'edit' | 'review'>('edit')
  // 放在頁面層而不是每張的編輯器裡：補英文時一路按下一張，語言不該被重設回中文。
  const [editLocale, setEditLocale] = useState<SupportedLocale>('zh-tw')
  const photosRef = useRef<StagedPhoto[]>([])
  photosRef.current = photos

  useEffect(() => {
    // 卸載時把還沒被移除的 object URL 一併釋放，避免整段瀏覽 session 累積記憶體。
    return () => {
      for (const p of photosRef.current) URL.revokeObjectURL(p.previewUrl)
    }
  }, [])

  const patch = (localId: string, next: Partial<StagedPhoto>) => {
    setPhotos((prev) =>
      prev.map((p) => (p.localId === localId ? { ...p, ...next } : p))
    )
  }

  const stageFiles = async (files: File[]) => {
    const accepted: File[] = []
    const newlyRejected: RejectedFile[] = []
    for (const file of files) {
      if (isSupportedPhotoMime(file.type)) accepted.push(file)
      else newlyRejected.push({ name: file.name })
    }
    if (newlyRejected.length > 0) {
      setRejected((prev) => [...prev, ...newlyRejected])
    }
    if (accepted.length === 0) return

    const staged: StagedPhoto[] = accepted.map((file) => ({
      localId: crypto.randomUUID(),
      assetId: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      width: 0,
      height: 0,
      status: 'reading',
      progress: 0,
      slug: '',
      takenAtLocal: '',
      hasExifDate: false,
      takenAtPrecision: 'day',
      captionZh: '',
      captionEn: '',
      locationNameZh: '',
      locationNameEn: '',
      includeGps: false,
      isHdr: false,
    }))
    setPhotos((prev) => [...prev, ...staged])
    setCurrentId(staged[0].localId)
    setStep('edit')

    const reads = await Promise.allSettled(
      staged.map(async (p) => {
        const [size, draft] = await Promise.all([
          readImageSize(p.file),
          readExifDraft(p.file),
        ])
        const hasExifDate = Boolean(draft.takenAtLocal)
        return {
          localId: p.localId,
          size,
          draft,
          hasExifDate,
          takenAtLocal: draft.takenAtLocal ?? fallbackTakenAtLocal(p.file),
        }
      })
    )

    const ok = reads.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
    const failedIds = staged
      .map((p, i) => (reads[i].status === 'rejected' ? p.localId : null))
      .filter((id): id is string => id !== null)
    for (const localId of failedIds) patch(localId, { status: 'invalid' })

    if (ok.length === 0) return

    // 批次配發 slug：一次查 DB 已用的字，之後在本地就地遞增，
    // 同一批 100 張也只打一次 getTakenSlugs。
    const bases = ok.map((r) => makePhotoSlugBase(r.takenAtLocal))
    let taken: Set<string>
    try {
      taken = await getTakenSlugs(supabase, bases)
    } catch {
      taken = new Set()
    }
    for (const p of photosRef.current) if (p.slug) taken.add(p.slug)

    for (let i = 0; i < ok.length; i++) {
      const r = ok[i]
      const slug = ensureUniquePhotoSlug(bases[i], taken)
      patch(r.localId, {
        width: r.size.w,
        height: r.size.h,
        status: 'ready',
        slug,
        takenAtLocal: r.takenAtLocal,
        hasExifDate: r.hasExifDate,
        tzOffset: r.draft.tzOffset,
        exif: r.draft.exif,
        gps: r.draft.gps,
        isHdr: r.draft.isHdr,
      })
    }
  }

  const removePhoto = (localId: string) => {
    const index = photos.findIndex((p) => p.localId === localId)
    if (index === -1) return
    URL.revokeObjectURL(photos[index].previewUrl)
    const rest = photos.filter((p) => p.localId !== localId)
    setPhotos(rest)
    if (localId === currentId) {
      setCurrentId(rest[Math.min(index, rest.length - 1)]?.localId ?? '')
    }
  }

  const clearAll = () => {
    for (const p of photos) URL.revokeObjectURL(p.previewUrl)
    setPhotos([])
    setRejected([])
    setCurrentId('')
    setStep('edit')
  }

  const isLocked = (p: StagedPhoto) =>
    p.status === 'uploading' ||
    p.status === 'processing' ||
    p.status === 'done' ||
    p.status === 'invalid'

  // 地名常常一整批都一樣：中英兩個語言一起帶給後面還能改的照片。
  const applyLocationAfter = (localId: string) => {
    const index = photos.findIndex((p) => p.localId === localId)
    const source = photos[index]
    if (!source) return
    setPhotos((prev) =>
      prev.map((p, i) =>
        i > index && !isLocked(p)
          ? {
              ...p,
              locationNameZh: source.locationNameZh,
              locationNameEn: source.locationNameEn,
            }
          : p
      )
    )
  }

  // 逐列驗證：格式合法、同批不重複。DB 層的撞號機率極低（單一管理員的站台），
  // 交給 ingest 的 409 處理，這裡不為此另外打 API。
  const slugErrors = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of photos) if (p.slug) counts.set(p.slug, (counts.get(p.slug) ?? 0) + 1)
    const errors: Record<string, string> = {}
    for (const p of photos) {
      if (!p.slug) continue
      const duplicate = (counts.get(p.slug) ?? 0) > 1
      if (duplicate || !isValidPhotoSlug(p.slug)) errors[p.localId] = t('invalidSlug')
    }
    return errors
  }, [photos, t])

  const confirmableIds = useMemo(
    () =>
      new Set(
        photos
          .filter(
            (p) =>
              p.status === 'ready' &&
              p.hasExifDate &&
              p.slug.length > 0 &&
              !slugErrors[p.localId]
          )
          .map((p) => p.localId)
      ),
    [photos, slugErrors]
  )

  const problemIds = new Set(
    photos
      .filter(
        (p) =>
          p.status === 'error' ||
          p.status === 'invalid' ||
          (p.status === 'ready' && !confirmableIds.has(p.localId))
      )
      .map((p) => p.localId)
  )

  const allDone = photos.length > 0 && photos.every((p) => p.status === 'done')

  const { run, cancel, running } = useUploadQueue({
    photosRef,
    takenAtLocalOf: (p) => normalizeTakenAtLocal(p.takenAtLocal, p.takenAtPrecision),
    takenAtOf: (p) =>
      toTakenAt(normalizeTakenAtLocal(p.takenAtLocal, p.takenAtPrecision), p.tzOffset),
    onPatch: patch,
    onDone: () => {
      // 個別完成時不用特別處理：photos 陣列已經是唯一事實來源，
      // 列表會自己因為 status:'done' 而顯示完成態。
    },
  })

  useEffect(() => {
    if (!running) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [running])

  const handleConfirm = () => {
    if (confirmableIds.size === 0) return
    setStep('review')
    void run([...confirmableIds])
  }

  const retryOne = (localId: string) => {
    void run([localId])
  }

  const currentIndex = Math.max(
    0,
    photos.findIndex((p) => p.localId === currentId)
  )
  const current = photos[currentIndex]
  const goTo = (index: number) => setCurrentId(photos[index]?.localId ?? '')

  return (
    <div className={style.upload_page}>
      <PageHeader
        title={t('heading')}
        subtitle={
          step === 'edit' && photos.length > 1
            ? t('stepOf', { current: currentIndex + 1, total: photos.length })
            : undefined
        }
        back={{ href: '/photos', label: t('back') }}
        // 主要操作放右上角，跟照片頁的「發布」同一個位置：只有一張時直接
        // 上傳，多張時隨時可以去檢查清單。
        action={
          current && step === 'edit' ? (
            photos.length === 1 && !running && !allDone ? (
              <Button onClick={handleConfirm} disabled={confirmableIds.size === 0}>
                <Icon name="upload" size="xs" />
                {t('uploadCount', { count: 1 })}
              </Button>
            ) : (
              <Button onClick={() => setStep('review')}>
                {t('review')}
                <Icon name="arrow-right" size="xs" />
              </Button>
            )
          ) : undefined
        }
      />

      {rejected.length > 0 && (
        <div className={style.rejected}>
          <p className={style.rejectedTitle}>
            {t('unsupportedTitle', { count: rejected.length })}
          </p>
          <p className={style.rejectedHint}>{t('unsupportedHint')}</p>
          <ul className={style.rejectedList}>
            {rejected.map((f, i) => (
              <li key={`${f.name}-${i}`}>{f.name}</li>
            ))}
          </ul>
        </div>
      )}

      {!current ? (
        <DropZone onFiles={(files) => void stageFiles(files)} />
      ) : step === 'review' ? (
        <UploadReview
          photos={photos}
          confirmableIds={confirmableIds}
          slugErrors={slugErrors}
          running={running}
          allDone={allDone}
          onEdit={(localId) => {
            setCurrentId(localId)
            setStep('edit')
          }}
          onBack={() => setStep('edit')}
          onConfirm={handleConfirm}
          onCancel={cancel}
          onClearAll={clearAll}
          onRetry={retryOne}
        />
      ) : (
        <StagedPhotoEditor
          key={current.localId}
          photo={current}
          slugError={slugErrors[current.localId]}
          editLocale={editLocale}
          onEditLocaleChange={setEditLocale}
          onChange={(next) => patch(current.localId, next)}
          onRemove={() => removePhoto(current.localId)}
          onRetry={() => retryOne(current.localId)}
          applyCount={photos.slice(currentIndex + 1).filter((p) => !isLocked(p)).length}
          onApplyLocation={() => applyLocationAfter(current.localId)}
          filmstrip={
            <Filmstrip
              items={photos.map((p, i) => ({
                id: p.localId,
                src: p.previewUrl,
                label: t('stepOf', { current: i + 1, total: photos.length }),
                mark:
                  p.status === 'done'
                    ? 'done'
                    : problemIds.has(p.localId)
                      ? 'warn'
                      : undefined,
              }))}
              currentId={current.localId}
              onSelect={setCurrentId}
            >
              <DropZone onFiles={(files) => void stageFiles(files)} compact />
            </Filmstrip>
          }
          onPrev={currentIndex > 0 ? () => goTo(currentIndex - 1) : undefined}
          onNext={currentIndex < photos.length - 1 ? () => goTo(currentIndex + 1) : undefined}
        />
      )}
    </div>
  )
}
