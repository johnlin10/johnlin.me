'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { createClient } from '@/app/lib/supabase/client'
import {
  createShortLink,
  deleteShortLink,
  getShortLinks,
  updateShortLink,
  type ShortLink,
} from '@/app/lib/supabase/shortLinks'
import { isUniqueViolation } from '@/app/lib/supabase/errors'
import { isValidSlug, normalizeTarget } from '@/app/lib/shortLinks'
import { SHORT_LINK_BASE } from '@/app/lib/siteConfigs'
import Icon from '@/app/components/Icon/Icon'
import PageHeader from '@/app/components/admin/PageHeader/PageHeader'
import Button from '@/app/components/admin/Button/Button'
import Input from '@/app/components/admin/Input/Input'
import Modal from '@/app/components/admin/Modal/Modal'
import DataTable, {
  type DataTableAction,
  type DataTableColumn,
} from '@/app/components/admin/DataTable/DataTable'
import { useToast } from '@/app/components/admin/Toast/ToastProvider'
import { useConfirm } from '@/app/components/admin/ConfirmDialog/ConfirmDialog'
import QrEditor, { newDraft, type Draft } from '../qr/QrEditor'
import style from './links.module.scss'

type LinkForm = { slug?: string; target: string; customSlug: string; note: string }

/**
 * 寫入剪貼簿。
 * @param text 要複製的文字
 * @returns 成功回 true
 */
function writeClipboard(text: string): Promise<boolean> {
  return (navigator.clipboard?.writeText(text) ?? Promise.reject()).then(
    () => true,
    () => false,
  )
}

/**
 * 短網址列表，首屏資料由 page.tsx 在伺服器端抓好帶進來。
 * @param props.initial 短網址清單；伺服器端沒抓到是 null
 */
export default function LinksTool({ initial }: { initial: ShortLink[] | null }) {
  const t = useTranslations('ToolsPage.links')
  const format = useFormatter()
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const supabase = useMemo(() => createClient(), [])
  const [links, setLinks] = useState<ShortLink[]>(initial ?? [])
  const [form, setForm] = useState<LinkForm | null>(null)
  const [qr, setQr] = useState<Draft | null>(null)

  const load = useCallback(async () => setLinks(await getShortLinks(supabase)), [supabase])

  useEffect(() => {
    if (!initial) toast.error(t('loadError'))
  }, [])

  const shortUrl = (slug: string) => `${SHORT_LINK_BASE}/${slug}`

  const copy = async (slug: string) => {
    const url = shortUrl(slug)
    if (await writeClipboard(url)) toast.success(t('copied', { url }))
    else toast.error(t('copyError'))
  }

  const save = async () => {
    if (!form) return
    const target = normalizeTarget(form.target)
    const note = form.note.trim() || null
    const customSlug = form.customSlug.trim().toLowerCase()
    if (!target) return toast.error(t('form.targetInvalid'))
    if (customSlug && !isValidSlug(customSlug)) return toast.error(t('form.slugInvalid'))
    try {
      if (form.slug) {
        await updateShortLink(supabase, form.slug, { target_url: target, note })
        toast.success(t('updated'))
      } else {
        const slug = await createShortLink(supabase, {
          slug: customSlug || null,
          target_url: target,
          note,
        })
        const url = shortUrl(slug)
        toast.success(t((await writeClipboard(url)) ? 'createdCopied' : 'created', { url }))
      }
      setForm(null)
      await load()
    } catch (error) {
      toast.error(isUniqueViolation(error) ? t('form.slugTaken') : t('saveError'))
    }
  }

  const remove = async (link: ShortLink) => {
    const ok = await confirm({
      title: t('deleteTitle'),
      message: t('deleteMessage', { slug: link.slug }),
      danger: true,
    })
    if (!ok) return
    try {
      await deleteShortLink(supabase, link.slug)
      await load()
    } catch {
      toast.error(t('deleteError'))
    }
  }

  const openNew = () => setForm({ target: '', customSlug: '', note: '' })

  const columns: DataTableColumn<ShortLink>[] = [
    {
      key: 'slug',
      header: t('table.slug'),
      render: (link) => (
        <span className={style.slugCell}>
          <code className={style.slug}>{link.slug}</code>
          <button
            type="button"
            className={style.copyButton}
            aria-label={t('copy')}
            title={t('copy')}
            onClick={() => copy(link.slug)}
          >
            <Icon name="copy" size="xs" />
          </button>
        </span>
      ),
    },
    {
      key: 'target',
      header: t('table.target'),
      truncate: true,
      maxWidth: '20rem',
      render: (link) => (
        <a
          href={link.target_url}
          target="_blank"
          rel="noreferrer"
          title={link.target_url}
          className={style.target}
        >
          {link.target_url.replace(/^https?:\/\//, '')}
        </a>
      ),
    },
    {
      key: 'note',
      header: t('table.note'),
      truncate: true,
      maxWidth: '12rem',
      render: (link) => <span title={link.note ?? ''}>{link.note}</span>,
    },
    {
      key: 'clicks',
      header: t('table.clicks'),
      render: (link) => format.number(link.clicks),
    },
    {
      key: 'recent',
      header: t('table.recent'),
      render: (link) => format.number(link.recent_clicks),
    },
    {
      key: 'created',
      header: t('table.created'),
      render: (link) =>
        format.dateTime(new Date(link.created_at), {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
    },
  ]

  const edit = (link: ShortLink) =>
    setForm({ slug: link.slug, target: link.target_url, customSlug: '', note: link.note ?? '' })

  const actions: DataTableAction<ShortLink>[] = [
    { label: t('stats'), onClick: (link) => router.push(`/links/${link.slug}`) },
    {
      label: t('qr'),
      onClick: (link) =>
        setQr(newDraft({ label: link.note || link.slug, fields: { url: shortUrl(link.slug) } })),
    },
    { label: t('delete'), variant: 'danger', onClick: remove },
  ]

  return (
    <div className={style.links_page}>
      <div className={style.container}>
        <PageHeader
          title={t('title')}
          subtitle={t('subtitle', { count: links.length })}
          action={<Button onClick={openNew}>{t('new')}</Button>}
        />

        {links.length === 0 ? (
          <div className={style.empty}>
            <p>{t('empty')}</p>
            <Button onClick={openNew}>{t('new')}</Button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={links}
            rowKey={(link) => link.slug}
            actions={actions}
            actionsAs="menu"
            actionsHeader={t('table.actions')}
            onRowClick={edit}
          />
        )}

        <Modal
          isOpen={form !== null}
          onClose={() => setForm(null)}
          title={form?.slug ? t('form.editTitle') : t('form.newTitle')}
        >
          {form && (
            <div className={style.form}>
              <Input
                label={t('form.target')}
                type="url"
                value={form.target}
                onChange={(target) => setForm({ ...form, target })}
                placeholder="https://"
                required
              />
              {form.slug ? (
                <Input
                  label={t('form.shortUrl')}
                  value={shortUrl(form.slug)}
                  onChange={() => {}}
                  disabled
                />
              ) : (
                <Input
                  label={t('form.slug')}
                  value={form.customSlug}
                  onChange={(customSlug) => setForm({ ...form, customSlug })}
                  placeholder="cv"
                  helper={t('form.slugHelper')}
                />
              )}
              <Input
                label={t('form.note')}
                value={form.note}
                onChange={(note) => setForm({ ...form, note })}
              />
              <div className={style.form_actions}>
                <Button variant="secondary" onClick={() => setForm(null)}>
                  {t('cancel')}
                </Button>
                <Button onClick={save}>{t('save')}</Button>
              </div>
            </div>
          )}
        </Modal>

        <QrEditor initial={qr} onClose={() => setQr(null)} locked />
      </div>
    </div>
  )
}
