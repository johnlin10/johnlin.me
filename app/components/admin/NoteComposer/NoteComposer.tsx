'use client'

import { useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/app/lib/supabase/client'
import { createNote, updateNote } from '@/app/lib/supabase/notes'
import { uploadImage, deleteImages } from '@/app/lib/supabase/storage'
import { readImageSize } from '@/app/lib/images/dimensions'
import type { Note, NoteImage, NoteStatus } from '@/app/types/note'
import { useToast } from '@/app/components/admin/Toast/ToastProvider'
import Button from '@/app/components/admin/Button/Button'
import NoteImageTray from './NoteImageTray'
import style from './NoteComposer.module.scss'

interface NoteComposerProps {
  mode: 'create' | 'edit'
  note?: Note
  onSaved: () => void
  onCancel?: () => void
}

/**
 * 短文編輯表單：建立與編輯共用同一套 UI。圖片上傳時當場讀取 w/h 存進 NoteImage，
 * 讓前台版面能算出正確比例；移除圖片在 create 模式立刻清 Storage，
 * edit 模式延後到儲存成功後才清（使用者可能會取消編輯）。
 */
export default function NoteComposer({
  mode,
  note,
  onSaved,
  onCancel,
}: NoteComposerProps) {
  const t = useTranslations('AdminPage.notes')
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const originalImages = useRef<NoteImage[]>(note?.images ?? [])

  const [content, setContent] = useState(note?.content ?? '')
  const [images, setImages] = useState<NoteImage[]>(note?.images ?? [])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aiPending, setAiPending] = useState<number | null>(null)

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const results = await Promise.allSettled(
        Array.from(files).map(async (file) => {
          const { w, h } = await readImageSize(file)
          const url = await uploadImage(supabase, file, '', 'notes')
          return { url, w, h } satisfies NoteImage
        })
      )
      const ok = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
      if (ok.length > 0) setImages((prev) => [...prev, ...ok])
      const failed = results.length - ok.length
      if (failed > 0) toast.error(t('uploadPartialError', { count: failed }))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const filesFromItems = (list: FileList | null | undefined) =>
    Array.from(list ?? []).filter((f) => f.type.startsWith('image/'))

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = filesFromItems(e.clipboardData?.files)
    if (files.length === 0) return
    e.preventDefault()
    const dt = new DataTransfer()
    files.forEach((f) => dt.items.add(f))
    void addFiles(dt.files)
  }

  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    const files = filesFromItems(e.dataTransfer?.files)
    if (files.length === 0) return
    e.preventDefault()
    const dt = new DataTransfer()
    files.forEach((f) => dt.items.add(f))
    void addFiles(dt.files)
  }

  const handleRemoveImage = (index: number) => {
    const removed = images[index]
    setImages((prev) => prev.filter((_, i) => i !== index))
    // create 模式下這張圖還沒被任何 note 記錄引用，可以立刻清掉；
    // edit 模式要等儲存成功才清（使用者可能按取消，見 save() 裡的 diff）。
    if (mode === 'create' && removed) {
      void deleteImages(supabase, [removed.url])
    }
  }

  const handleAltChange = (index: number, alt: string) => {
    setImages((prev) => prev.map((img, i) => (i === index ? { ...img, alt } : img)))
  }

  const generateAlt = async (index: number) => {
    setAiPending(index)
    try {
      const res = await fetch('/api/admin/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          task: 'coverAlt',
          payload: { imageUrl: images[index].url },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? t('aiAltError'))
        return
      }
      setImages((prev) =>
        prev.map((img, i) => (i === index ? { ...img, alt: data.result } : img))
      )
    } catch {
      toast.error(t('aiAltError'))
    } finally {
      setAiPending(null)
    }
  }

  const save = async (targetStatus: NoteStatus) => {
    if (!content.trim() && images.length === 0) {
      toast.error(t('contentRequired'))
      return
    }
    setSaving(true)
    try {
      if (mode === 'create') {
        await createNote(supabase, {
          content: content.trim(),
          images,
          status: targetStatus,
        })
        toast.success(targetStatus === 'published' ? t('publishSuccess') : t('saveSuccess'))
        setContent('')
        setImages([])
      } else if (note) {
        await updateNote(supabase, {
          id: note.id,
          content: content.trim(),
          images,
          status: targetStatus,
        })
        const removedUrls = originalImages.current
          .filter((orig) => !images.some((img) => img.url === orig.url))
          .map((img) => img.url)
        if (removedUrls.length > 0) await deleteImages(supabase, removedUrls)
        toast.success(targetStatus === 'published' ? t('publishSuccess') : t('saveSuccess'))
      }
      onSaved()
    } catch {
      toast.error(mode === 'create' ? t('publishError') : t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`${style.composer} ${mode === 'edit' ? style.edit : ''}`}>
      <textarea
        className={style.textarea}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        placeholder={t('placeholder')}
        rows={4}
      />

      {images.length > 0 && (
        <NoteImageTray
          images={images}
          onReorder={setImages}
          onRemove={handleRemoveImage}
          onAltChange={handleAltChange}
          aiPendingIndex={aiPending}
          onGenerateAlt={(i) => void generateAlt(i)}
        />
      )}

      <div className={style.toolbar}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => void addFiles(e.target.files)}
        />
        <Button
          variant="secondary"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? t('uploading') : t('addImage')}
        </Button>

        <div className={style.spacer} />

        {mode === 'edit' && onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            {t('cancel')}
          </Button>
        )}

        {mode === 'create' && (
          <Button
            variant="secondary"
            onClick={() => save('draft')}
            disabled={saving || uploading}
          >
            {t('saveDraft')}
          </Button>
        )}

        {mode === 'edit' && note?.status === 'published' && (
          <Button
            variant="secondary"
            onClick={() => save('draft')}
            disabled={saving || uploading}
          >
            {t('unpublish')}
          </Button>
        )}

        <Button onClick={() => save('published')} disabled={saving || uploading}>
          {mode === 'create' || note?.status === 'draft'
            ? saving
              ? t('publishing')
              : t('publish')
            : saving
              ? t('saving')
              : t('save')}
        </Button>
      </div>
    </div>
  )
}
