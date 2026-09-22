'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { createClient } from '@/app/lib/supabase/client'
import { getKbHashes, getKbNotes, syncKb, type KbNote } from '@/app/lib/supabase/kb'
import {
  KB_ROOTS,
  buildTree,
  extractLinks,
  hashContent,
  isNotePath,
  planSync,
  type NoteTreeNode,
} from '@/app/lib/kb'
import PageHeader from '@/app/components/admin/PageHeader/PageHeader'
import Button from '@/app/components/admin/Button/Button'
import Icon from '@/app/components/Icon/Icon'
import { useToast } from '@/app/components/admin/Toast/ToastProvider'
import { useConfirm } from '@/app/components/admin/ConfirmDialog/ConfirmDialog'
import style from './kb.module.scss'

// 刪除確認裡最多列出幾篇的名字
const LISTED_REMOVALS = 5

/**
 * 知識庫：選 Obsidian 的資料夾整包上傳，只送改過的，資料夾裡沒有的就刪掉。
 * @param props.initial 已上傳的筆記；伺服器端沒抓到是 null
 */
export default function KbTool({ initial }: { initial: KbNote[] | null }) {
  const t = useTranslations('ToolsPage.kb')
  const format = useFormatter()
  const toast = useToast()
  const confirm = useConfirm()
  const supabase = useMemo(() => createClient(), [])
  const input = useRef<HTMLInputElement>(null)
  const [notes, setNotes] = useState<KbNote[]>(initial ?? [])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!initial) toast.error(t('loadError'))
  }, [])

  const tree = useMemo(() => buildTree(notes.map((note) => note.path)), [notes])
  const dates = useMemo(
    () => new Map(notes.map((note) => [note.path, note.updated_at])),
    [notes],
  )

  const upload = async (files: File[]) => {
    const picked = files.map((file) => ({ file, path: file.webkitRelativePath.normalize('NFC') }))
    const root = picked[0]?.path.split('/')[0]
    if (!root || !KB_ROOTS.includes(root)) {
      toast.error(t('wrongRoot', { roots: KB_ROOTS.join('、') }))
      return
    }
    const noteFiles = picked.filter(({ path }) => isNotePath(path))
    if (noteFiles.length === 0) {
      toast.error(t('noNotes'))
      return
    }

    setBusy(true)
    try {
      const local = await Promise.all(
        noteFiles.map(async ({ file, path }) => {
          const content = await file.text()
          return { path, content, hash: await hashContent(content), links: extractLinks(content) }
        }),
      )
      const prefix = `${root}/`
      const plan = planSync(
        new Map(local.map((note) => [note.path, note.hash])),
        await getKbHashes(supabase, prefix),
      )
      if (plan.added.length + plan.changed.length + plan.removed.length === 0) {
        toast.success(t('noChanges'))
        return
      }

      const counts = t('confirmCounts', {
        added: plan.added.length,
        changed: plan.changed.length,
        removed: plan.removed.length,
      })
      const removedNames = plan.removed
        .slice(0, LISTED_REMOVALS)
        .map((path) => path.split('/').pop()!.replace(/\.md$/, ''))
        .join('、')
      const ok = await confirm({
        title: t('confirmTitle'),
        message:
          plan.removed.length > 0
            ? `${counts}${t('confirmRemoved', {
                names: removedNames,
                more: plan.removed.length - LISTED_REMOVALS,
              })}`
            : counts,
        danger: plan.removed.length > 0,
      })
      if (!ok) return

      const touched = new Set([...plan.added, ...plan.changed])
      await syncKb(
        supabase,
        prefix,
        local.filter((note) => touched.has(note.path)),
        local.map((note) => note.path),
      )
      setNotes(await getKbNotes(supabase))
      toast.success(t('synced'))
    } catch {
      toast.error(t('syncError'))
    } finally {
      setBusy(false)
    }
  }

  const renderNodes = (nodes: NoteTreeNode[], depth: number) => (
    <ul className={style.tree}>
      {nodes.map((node) =>
        node.path.endsWith('.md') ? (
          <li key={node.path} className={style.note}>
            <span className={style.noteName}>{node.name}</span>
            <span className={style.noteDate}>
              {format.dateTime(new Date(dates.get(node.path)!), { dateStyle: 'medium' })}
            </span>
          </li>
        ) : (
          <li key={node.path}>
            {/* 前兩層（學校、學期與資料庫）預設展開 */}
            <details open={depth < 2}>
              <summary className={style.folder}>
                <Icon name="folder" className={style.folderIcon} />
                {node.name}
              </summary>
              {renderNodes(node.children, depth + 1)}
            </details>
          </li>
        ),
      )}
    </ul>
  )

  return (
    <div className={style.page}>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle', { count: notes.length })}
        action={
          <Button onClick={() => input.current?.click()} disabled={busy}>
            {busy ? t('uploading') : t('upload')}
          </Button>
        }
      />

      <input
        ref={input}
        type="file"
        hidden
        multiple
        // React 的型別沒有 webkitdirectory，用展開塞進去
        {...{ webkitdirectory: '' }}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          if (files.length > 0) upload(files)
        }}
      />

      <p className={style.hint}>{t('hint', { roots: KB_ROOTS.join('、') })}</p>

      {notes.length === 0 ? <p className={style.hint}>{t('empty')}</p> : renderNodes(tree, 0)}
    </div>
  )
}
