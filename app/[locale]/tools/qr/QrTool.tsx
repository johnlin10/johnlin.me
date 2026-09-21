'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { createClient } from '@/app/lib/supabase/client'
import { deleteQrCode, getQrCodes, type QrCode } from '@/app/lib/supabase/qrCodes'
import PageHeader from '@/app/components/admin/PageHeader/PageHeader'
import Button from '@/app/components/admin/Button/Button'
import DataTable, {
  type DataTableAction,
  type DataTableColumn,
} from '@/app/components/admin/DataTable/DataTable'
import { useToast } from '@/app/components/admin/Toast/ToastProvider'
import { useConfirm } from '@/app/components/admin/ConfirmDialog/ConfirmDialog'
import QrEditor, {
  failureOf,
  newDraft,
  payloadOf,
  savePng,
  saveSvg,
  toDraft,
  type Draft,
} from './QrEditor'
import style from './qr.module.scss'

/**
 * QR Code 產生器，首屏清單由 page.tsx 在伺服器端抓好帶進來。
 * @param props.initial 存下來的 QR Code 清單；伺服器端沒抓到是 null
 */
export default function QrTool({ initial }: { initial: QrCode[] | null }) {
  const t = useTranslations('ToolsPage.qr')
  const format = useFormatter()
  const toast = useToast()
  const confirm = useConfirm()
  const supabase = useMemo(() => createClient(), [])
  const [codes, setCodes] = useState<QrCode[]>(initial ?? [])
  const [draft, setDraft] = useState<Draft | null>(null)

  const load = useCallback(async () => setCodes(await getQrCodes(supabase)), [supabase])

  useEffect(() => {
    if (!initial) toast.error(t('loadError'))
  }, [])

  const remove = async (code: QrCode) => {
    const ok = await confirm({
      title: t('deleteTitle'),
      message: t('deleteMessage', { label: code.label }),
      danger: true,
    })
    if (!ok) return
    try {
      await deleteQrCode(supabase, code.id)
      await load()
    } catch {
      toast.error(t('deleteError'))
    }
  }

  const columns: DataTableColumn<QrCode>[] = [
    {
      key: 'label',
      header: t('table.label'),
      render: (code) => <span className={style.label}>{code.label}</span>,
    },
    {
      key: 'kind',
      header: t('table.kind'),
      render: (code) => <span className={style.kindTag}>{t(`kinds.${code.kind}`)}</span>,
    },
    {
      key: 'content',
      header: t('table.content'),
      truncate: true,
      maxWidth: '22rem',
      render: (code) => {
        const text = payloadOf(code.kind, code.fields)
        return (
          <code className={style.payload} title={text}>
            {text}
          </code>
        )
      },
    },
    {
      key: 'created',
      header: t('table.created'),
      render: (code) => format.dateTime(new Date(code.created_at), { dateStyle: 'medium' }),
    },
  ]

  const actions: DataTableAction<QrCode>[] = [
    {
      label: t('downloadPng'),
      onClick: (code) => savePng(toDraft(code)) || toast.error(t(failureOf(code))),
    },
    {
      label: t('downloadSvg'),
      onClick: (code) => saveSvg(toDraft(code)) || toast.error(t(failureOf(code))),
    },
    { label: t('edit'), onClick: (code) => setDraft(toDraft(code)) },
    { label: t('delete'), onClick: (code) => remove(code), variant: 'danger' },
  ]

  return (
    <div className={style.page}>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle', { count: codes.length })}
        action={<Button onClick={() => setDraft(newDraft())}>{t('new')}</Button>}
      />

      {codes.length === 0 ? (
        <p className={style.hint}>{t('empty')}</p>
      ) : (
        <DataTable
          columns={columns}
          data={codes}
          rowKey={(code) => code.id}
          actions={actions}
          actionsHeader={t('table.actions')}
          actionsAs="menu"
          onRowClick={(code) => setDraft(toDraft(code))}
        />
      )}

      <QrEditor initial={draft} onClose={() => setDraft(null)} onSaved={load} />
    </div>
  )
}
