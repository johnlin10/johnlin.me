'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { createClient } from '@/app/lib/supabase/client'
import {
  getNotesForAdmin,
  updateNote,
  deleteNote,
} from '@/app/lib/supabase/notes'
import { deleteImages } from '@/app/lib/supabase/storage'
import { readImageSizeFromUrl } from '@/app/lib/images/dimensions'
import type { Note } from '@/app/types/note'
import Button from '@/app/components/admin/Button/Button'
import PageHeader from '@/app/components/admin/PageHeader/PageHeader'
import { useToast } from '@/app/components/admin/Toast/ToastProvider'
import { useConfirm } from '@/app/components/admin/ConfirmDialog/ConfirmDialog'
import NoteComposer from '@/app/components/admin/NoteComposer/NoteComposer'
import NoteMedia from '@/app/components/notes/NoteMedia/NoteMedia'
import style from './notes.module.scss'

/**
 * 短文管理：頂部 composer（建立）＋ 下方列表（可就地編輯／刪除）。
 * 列表的圖片預覽直接用前台的 NoteMedia，後台看到的排版就是訪客會看到的排版。
 */
export default function AdminNotesPage() {
  const t = useTranslations('AdminPage.notes')
  const locale = useLocale()
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  const confirm = useConfirm()

  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [backfilling, setBackfilling] = useState(false)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      setNotes(await getNotesForAdmin(supabase))
    } catch {
      toast.error(t('loadError'))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (note: Note) => {
    const ok = await confirm({
      title: t('deleteConfirmTitle'),
      message: t('deleteConfirmMessage'),
      danger: true,
    })
    if (!ok) return
    try {
      await deleteNote(supabase, note.id)
      if (note.images.length > 0) {
        await deleteImages(
          supabase,
          note.images.map((img) => img.url),
        )
      }
      toast.success(t('deleteSuccess'))
      load()
    } catch {
      toast.error(t('deleteError'))
    }
  }

  const needsBackfill = notes.filter((n) =>
    n.images.some((img) => !img.w || !img.h),
  )

  const handleBackfill = async () => {
    setBackfilling(true)
    try {
      for (const n of needsBackfill) {
        const images = await Promise.all(
          n.images.map(async (img) =>
            img.w && img.h
              ? img
              : { ...img, ...(await readImageSizeFromUrl(img.url)) },
          ),
        )
        await updateNote(supabase, { id: n.id, images })
      }
      toast.success(t('backfillDone', { count: needsBackfill.length }))
      load()
    } catch {
      toast.error(t('backfillError'))
    } finally {
      setBackfilling(false)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(locale === 'zh-tw' ? 'zh-TW' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className={style.container}>
      <PageHeader
        title={t('heading')}
        subtitle={
          <>
            {t('count.total')}
            {notes.length}
            {t('count.unit')}
          </>
        }
        action={
          needsBackfill.length > 0 ? (
            <Button
              variant="ghost"
              size="small"
              onClick={handleBackfill}
              disabled={backfilling}
            >
              {t('backfillDims')}
            </Button>
          ) : undefined
        }
      />

      <NoteComposer mode="create" onSaved={load} />

      {loading ? (
        <div className={style.loading}>{t('loading')}</div>
      ) : notes.length === 0 ? (
        <div className={style.empty}>{t('empty')}</div>
      ) : (
        <div className={style.list}>
          {notes.map((note) =>
            editingId === note.id ? (
              <NoteComposer
                key={note.id}
                mode="edit"
                note={note}
                onSaved={() => {
                  setEditingId(null)
                  load()
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div key={note.id} className={style.item}>
                <div className={style.itemHeader}>
                  <div className={style.itemMetaRow}>
                    <time className={style.itemMeta}>
                      {formatDate(note.publishedAt ?? note.createdAt)}
                    </time>
                    <span
                      className={`${style.statusPill} ${
                        note.status === 'draft'
                          ? style.statusDraft
                          : style.statusPublished
                      }`}
                    >
                      {note.status === 'draft'
                        ? t('statusDraft')
                        : t('statusPublished')}
                    </span>
                  </div>

                  <div className={style.itemActions}>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => setEditingId(note.id)}
                    >
                      {t('edit')}
                    </Button>
                    <Button
                      variant="danger"
                      size="small"
                      onClick={() => handleDelete(note)}
                    >
                      {t('delete')}
                    </Button>
                  </div>
                </div>

                {note.content && (
                  <p className={style.itemContent}>{note.content}</p>
                )}

                {note.images.length > 0 && (
                  <div className={style.itemMedia}>
                    <NoteMedia noteId={note.id} images={note.images} />
                  </div>
                )}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  )
}
