'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { createClient } from '@/app/lib/supabase/client'
import {
  createKbShareLink,
  deleteKbShareLink,
  getKbHashes,
  getKbNotes,
  renameKbShareLink,
  setKnowledgeFolder,
  syncKb,
  type KbNote,
  type KbShareLink,
} from '@/app/lib/supabase/kb'
import {
  KB_ROOTS,
  buildTree,
  extractLinks,
  hashContent,
  isNotePath,
  planSync,
  type NoteTreeNode,
} from '@/app/lib/kb'
import { SITE_CONFIG } from '@/app/lib/siteConfigs'
import PageHeader from '@/app/components/admin/PageHeader/PageHeader'
import Button from '@/app/components/admin/Button/Button'
import Input from '@/app/components/admin/Input/Input'
import Modal from '@/app/components/admin/Modal/Modal'
import DataTable, {
  type DataTableAction,
  type DataTableColumn,
} from '@/app/components/admin/DataTable/DataTable'
import Icon from '@/app/components/Icon/Icon'
import { useToast } from '@/app/components/admin/Toast/ToastProvider'
import { useConfirm } from '@/app/components/admin/ConfirmDialog/ConfirmDialog'
import style from './kb.module.scss'

// 刪除確認裡最多列出幾篇的名字
const LISTED_REMOVALS = 5

type KbData = { notes: KbNote[]; shares: KbShareLink[]; knowledge: string[] }

/**
 * 路徑最後一段的名稱，筆記去掉 .md。
 * @param path 筆記路徑或資料夾
 * @returns 名稱
 */
function nameOf(path: string) {
  return path.replace(/\/$/, '').split('/').pop()!.replace(/\.md$/, '')
}

/**
 * 分享連結的網址。
 * @param token 分享 token
 * @returns 主站網址
 */
function shareUrl(token: string) {
  return `${SITE_CONFIG.url}/kb/${token}`
}

/**
 * 知識庫：選 Obsidian 的資料夾整包上傳，只送改過的，資料夾裡沒有的就刪掉。
 * 在檔案樹上開分享連結、設定知識資料夾。
 * @param props.initial 筆記、分享連結和知識資料夾；伺服器端沒抓到是 null
 */
export default function KbTool({ initial }: { initial: KbData | null }) {
  const t = useTranslations('ToolsPage.kb')
  const format = useFormatter()
  const toast = useToast()
  const confirm = useConfirm()
  const supabase = useMemo(() => createClient(), [])
  const input = useRef<HTMLInputElement>(null)
  const [notes, setNotes] = useState<KbNote[]>(initial?.notes ?? [])
  const [shares, setShares] = useState<KbShareLink[]>(initial?.shares ?? [])
  const [knowledge, setKnowledge] = useState<string[]>(initial?.knowledge ?? [])
  const [busy, setBusy] = useState(false)
  // 正在開分享連結的筆記或資料夾
  const [sharing, setSharing] = useState<{ scope: string; label: string } | null>(null)
  // 正在改名的分享連結
  const [renaming, setRenaming] = useState<{ share: KbShareLink; label: string } | null>(null)

  useEffect(() => {
    if (!initial) toast.error(t('loadError'))
  }, [])

  const tree = useMemo(() => buildTree(notes.map((note) => note.path)), [notes])
  const dates = useMemo(
    () => new Map(notes.map((note) => [note.path, note.updated_at])),
    [notes],
  )

  // 改名、搬走或刪掉之後，分享範圍裡已經沒有筆記
  const isBroken = (scope: string) =>
    scope.endsWith('/')
      ? !notes.some((note) => note.path.startsWith(scope))
      : !dates.has(scope)

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
      const removedNames = plan.removed.slice(0, LISTED_REMOVALS).map(nameOf).join('、')
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

  const copy = async (token: string) => {
    const ok = await (navigator.clipboard?.writeText(shareUrl(token)) ?? Promise.reject()).then(
      () => true,
      () => false,
    )
    if (ok) toast.success(t('shares.copied'))
    else toast.error(t('shares.copyError'))
  }

  const createShare = async () => {
    if (!sharing) return
    try {
      const share = await createKbShareLink(supabase, sharing.scope, sharing.label.trim() || null)
      setShares((current) => [share, ...current])
      setSharing(null)
      await copy(share.token)
    } catch {
      toast.error(t('shares.createError'))
    }
  }

  const rename = async () => {
    if (!renaming) return
    const label = renaming.label.trim() || null
    try {
      await renameKbShareLink(supabase, renaming.share.token, label)
      setShares((current) =>
        current.map((s) => (s.token === renaming.share.token ? { ...s, label } : s)),
      )
      setRenaming(null)
    } catch {
      toast.error(t('shares.renameError'))
    }
  }

  const revoke = async (share: KbShareLink) => {
    const ok = await confirm({
      title: t('shares.revokeTitle'),
      message: t('shares.revokeMessage', { name: share.label ?? nameOf(share.scope) }),
      confirmLabel: t('shares.revoke'),
      danger: true,
    })
    if (!ok) return
    try {
      await deleteKbShareLink(supabase, share.token)
      setShares((current) => current.filter((s) => s.token !== share.token))
      toast.success(t('shares.revoked'))
    } catch {
      toast.error(t('shares.revokeError'))
    }
  }

  const toggleKnowledge = async (path: string) => {
    const on = !knowledge.includes(path)
    // 設定會讓現有的分享多看到東西，取消只會變少，所以只有設定要確認
    if (
      on &&
      !(await confirm({
        title: t('knowledge.onTitle'),
        message: t('knowledge.onMessage', { name: nameOf(path) }),
      }))
    ) {
      return
    }
    try {
      await setKnowledgeFolder(supabase, path, on)
      setKnowledge((current) => (on ? [...current, path] : current.filter((k) => k !== path)))
    } catch {
      toast.error(t('knowledge.error'))
    }
  }

  const columns: DataTableColumn<KbShareLink>[] = [
    {
      key: 'name',
      header: t('shares.name'),
      render: (share) => (
        <span className={style.shareName}>
          {share.label ?? nameOf(share.scope)}
          {isBroken(share.scope) && (
            <span className={style.broken} title={t('shares.brokenHint')}>
              {t('shares.broken')}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'scope',
      header: t('shares.scope'),
      truncate: true,
      render: (share) => <span title={share.scope}>{share.scope.replace(/\.md$/, '')}</span>,
    },
    {
      key: 'created',
      header: t('shares.created'),
      render: (share) => format.dateTime(new Date(share.created_at), { dateStyle: 'medium' }),
    },
  ]

  const actions: DataTableAction<KbShareLink>[] = [
    { label: t('shares.copy'), onClick: (share) => copy(share.token) },
    {
      label: t('shares.rename'),
      onClick: (share) => setRenaming({ share, label: share.label ?? '' }),
    },
    { label: t('shares.revoke'), variant: 'danger', onClick: revoke },
  ]

  // 只算直接分享這個筆記或資料夾的連結，資料夾連結裡看得到的筆記不算
  const sharesByScope = useMemo(() => Map.groupBy(shares, (share) => share.scope), [shares])

  const shareButton = (path: string) => {
    const count = sharesByScope.get(path)?.length ?? 0
    return (
      <button
        type="button"
        className={`${style.rowAction} ${count > 0 ? style.rowActionOn : ''}`}
        aria-label={t('shares.shareName', { name: nameOf(path) })}
        title={count > 0 ? t('shares.existing', { count }) : t('shares.share')}
        // 放在 summary 裡，不擋掉的話會一起開合資料夾
        onClick={(event) => {
          event.preventDefault()
          setSharing({ scope: path, label: '' })
        }}
      >
        <Icon name="link" />
      </button>
    )
  }

  const existing = sharing ? (sharesByScope.get(sharing.scope) ?? []) : []

  const renderNodes = (nodes: NoteTreeNode[], depth: number) => (
    <ul className={style.tree}>
      {nodes.map((node) => {
        if (node.path.endsWith('.md')) {
          return (
            <li key={node.path} className={style.row}>
              <span className={style.rowName}>{node.name}</span>
              <span className={style.rowMeta}>
                {format.dateTime(new Date(dates.get(node.path)!), { dateStyle: 'medium' })}
              </span>
              <span className={style.rowActions}>{shareButton(node.path)}</span>
            </li>
          )
        }
        const listed = knowledge.includes(node.path)
        // 上層已經是知識資料夾，這層設不設都一樣
        const covered = !listed && knowledge.some((k) => node.path.startsWith(k))
        return (
          <li key={node.path}>
            {/* 前三層（學校、學期與資料庫、科目）預設展開 */}
            <details open={depth < 3}>
              <summary className={`${style.row} ${style.folder}`}>
                <span className={style.rowName}>
                  <Icon name="folder" className={style.folderIcon} />
                  {node.name}
                </span>
                <span className={style.rowMeta}>
                  {listed && <span className={style.badge}>{t('knowledge.badge')}</span>}
                </span>
                <span className={style.rowActions}>
                  {!covered && (
                    <button
                      type="button"
                      className={`${style.rowAction} ${listed ? style.rowActionOn : ''}`}
                      aria-pressed={listed}
                      aria-label={t('knowledge.toggle', { name: node.name })}
                      title={listed ? t('knowledge.off') : t('knowledge.on')}
                      onClick={(event) => {
                        event.preventDefault()
                        toggleKnowledge(node.path)
                      }}
                    >
                      <Icon name="book" />
                    </button>
                  )}
                  {shareButton(node.path)}
                </span>
              </summary>
              {renderNodes(node.children, depth + 1)}
            </details>
          </li>
        )
      })}
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

      <section className={style.group}>
        <h2 className={style.groupTitle}>{t('shares.title')}</h2>
        {shares.length === 0 ? (
          <p className={style.hint}>{t('shares.empty')}</p>
        ) : (
          <DataTable
            columns={columns}
            data={shares}
            rowKey={(share) => share.token}
            actions={actions}
            actionsAs="menu"
            actionsHeader={t('shares.actions')}
          />
        )}
      </section>

      <section className={style.group}>
        <h2 className={style.groupTitle}>{t('notesTitle')}</h2>
        <p className={style.hint}>{t('hint', { roots: KB_ROOTS.join('、') })}</p>
        <p className={style.hint}>{t('knowledge.hint')}</p>
        {notes.length === 0 ? <p className={style.hint}>{t('empty')}</p> : renderNodes(tree, 0)}
      </section>

      <Modal
        isOpen={sharing !== null}
        onClose={() => setSharing(null)}
        title={sharing ? t('shares.newTitle', { name: nameOf(sharing.scope) }) : ''}
        size="small"
      >
        {sharing && (
          <div className={style.form}>
            {existing.length > 0 && (
              <div className={style.existing}>
                <p className={style.existingTitle}>
                  {t('shares.existing', { count: existing.length })}
                </p>
                <ul className={style.existingList}>
                  {existing.map((share) => (
                    <li key={share.token} className={style.existingItem}>
                      <span className={style.noteName}>{share.label ?? nameOf(share.scope)}</span>
                      <span className={style.noteDate}>
                        {format.dateTime(new Date(share.created_at), { dateStyle: 'medium' })}
                      </span>
                      <Button size="small" variant="secondary" onClick={() => copy(share.token)}>
                        {t('shares.copy')}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className={style.hint}>
              {sharing.scope.endsWith('/') ? t('shares.folderScope') : t('shares.noteScope')}
            </p>
            <Input
              label={t('shares.label')}
              value={sharing.label}
              onChange={(label) => setSharing({ ...sharing, label })}
              placeholder={nameOf(sharing.scope)}
              helper={t('shares.labelHelper')}
            />
            <div className={style.form_actions}>
              <Button variant="secondary" onClick={() => setSharing(null)}>
                {t('cancel')}
              </Button>
              <Button onClick={createShare}>{t('shares.create')}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={renaming !== null}
        onClose={() => setRenaming(null)}
        title={t('shares.renameTitle')}
        size="small"
      >
        {renaming && (
          <div className={style.form}>
            <Input
              label={t('shares.label')}
              value={renaming.label}
              onChange={(label) => setRenaming({ ...renaming, label })}
              placeholder={nameOf(renaming.share.scope)}
              helper={t('shares.labelHelper')}
            />
            <div className={style.form_actions}>
              <Button variant="secondary" onClick={() => setRenaming(null)}>
                {t('cancel')}
              </Button>
              <Button onClick={rename}>{t('shares.save')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
