'use client'

import { useMemo, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { createClient } from '@/app/lib/supabase/client'
import {
  deleteCalendarDay,
  getCalendarDays,
  importCalendarDays,
  saveCalendarDay,
  type CalendarDay,
} from '@/app/lib/supabase/calendar'
import type { ImportedDay } from '@/app/lib/holidays'
import Button from '@/app/components/admin/Button/Button'
import Input from '@/app/components/admin/Input/Input'
import Modal from '@/app/components/admin/Modal/Modal'
import DropdownSelect from '@/app/components/admin/Selector/DropdownSelect'
import { useToast } from '@/app/components/admin/Toast/ToastProvider'
import { useConfirm } from '@/app/components/admin/ConfirmDialog/ConfirmDialog'
import style from './HolidayEditor.module.scss'

// 下拉的第一個選項：那天不上課。其餘七個是補哪一天的課
const OFF = 'off'

type DayForm = {
  // 開啟表單時的日期，改掉日期要連帶刪掉舊的那一列（日期是主鍵）
  original?: string
  date: string
  source: string
  label: string
}

/**
 * 放假和補課的日子。課表和完善就學共用同一份，兩邊的管理區都開得起來。
 * @param props.isOpen 開著沒
 * @param props.onClose 關閉時呼叫
 * @param props.days 目前的清單
 * @param props.onChange 存檔或刪除後呼叫，帶重新讀出來的清單
 */
export default function HolidayEditor({
  isOpen,
  onClose,
  days,
  onChange,
}: {
  isOpen: boolean
  onClose: () => void
  days: CalendarDay[]
  onChange: (days: CalendarDay[]) => void
}) {
  const t = useTranslations('ToolsPage.holidays')
  const format = useFormatter()
  const toast = useToast()
  const confirm = useConfirm()
  const supabase = useMemo(() => createClient(), [])
  const [form, setForm] = useState<DayForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)

  // 2024-01-01 是週一，用它排出七個星期幾的名字
  const weekdayName = (day: number) =>
    format.dateTime(new Date(2024, 0, day, 12), { weekday: 'long' })

  const sourceOptions = [
    { value: OFF, label: t('off') },
    ...[1, 2, 3, 4, 5, 6, 7].map((day) => ({
      value: String(day),
      label: t('makeupOf', { day: weekdayName(day) }),
    })),
  ]

  const refresh = async () => onChange(await getCalendarDays(supabase))

  const submit = async () => {
    if (!form) return
    if (!form.date) return toast.error(t('dateRequired'))
    if (!form.label.trim()) return toast.error(t('labelRequired'))

    setSaving(true)
    try {
      // 日期是主鍵，改掉日期等於搬家，舊的那一列要自己收掉
      if (form.original && form.original !== form.date) {
        await deleteCalendarDay(supabase, form.original)
      }
      await saveCalendarDay(supabase, {
        date: form.date,
        source_day: form.source === OFF ? null : Number(form.source),
        label: form.label.trim(),
      })
      await refresh()
      setForm(null)
    } catch {
      toast.error(t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  // 國定假日每年就那十幾天，從公開行事曆抓比自己查行事曆快。
  // 學校自己的補課、校慶那些抓不到，照樣手動加
  const runImport = async () => {
    setImporting(true)
    try {
      const response = await fetch('/api/admin/holidays')
      if (!response.ok) throw new Error(String(response.status))
      const { days: fetched } = (await response.json()) as { days: ImportedDay[] }
      const added = await importCalendarDays(
        supabase,
        fetched.map((day) => ({ ...day, source_day: null })),
      )
      await refresh()
      toast.success(t('imported', { added, skipped: fetched.length - added }))
    } catch {
      toast.error(t('importError'))
    } finally {
      setImporting(false)
    }
  }

  const remove = async () => {
    if (!form?.original) return
    const ok = await confirm({
      title: t('deleteTitle'),
      message: t('deleteMessage', { date: form.original }),
      danger: true,
    })
    if (!ok) return
    try {
      await deleteCalendarDay(supabase, form.original)
      await refresh()
      setForm(null)
    } catch {
      toast.error(t('deleteError'))
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setForm(null)
        onClose()
      }}
      title={t('title')}
    >
      {form ? (
        <div className={style.form}>
          <Input
            label={t('date')}
            type="date"
            value={form.date}
            onChange={(date) => setForm({ ...form, date })}
            required
          />
          <div className={style.field}>
            <span className={style.label}>{t('kind')}</span>
            <DropdownSelect
              value={form.source}
              onChange={(source) => setForm({ ...form, source })}
              options={sourceOptions}
              placeholder={t('kind')}
              clearable={false}
            />
          </div>
          <Input
            label={t('label')}
            value={form.label}
            onChange={(label) => setForm({ ...form, label })}
            placeholder={form.source === OFF ? t('labelPlaceholderOff') : t('labelPlaceholderMakeup')}
            required
          />
          <div className={style.form_actions}>
            {form.original && (
              <Button variant="danger" className={style.pushStart} onClick={remove}>
                {t('delete')}
              </Button>
            )}
            <Button variant="secondary" onClick={() => setForm(null)}>
              {t('cancel')}
            </Button>
            <Button onClick={submit} disabled={saving}>
              {t('save')}
            </Button>
          </div>
        </div>
      ) : (
        <div className={style.body}>
          <p className={style.hint}>{t('hint')}</p>

          {days.length === 0 ? (
            <p className={style.empty}>{t('empty')}</p>
          ) : (
            <ul className={style.list}>
              {days.map((day) => (
                <li key={day.date}>
                  <button
                    type="button"
                    className={style.row}
                    onClick={() =>
                      setForm({
                        original: day.date,
                        date: day.date,
                        source: day.source_day === null ? OFF : String(day.source_day),
                        label: day.label,
                      })
                    }
                  >
                    <span className={style.date}>
                      {format.dateTime(new Date(`${day.date}T12:00:00`), {
                        year: 'numeric',
                        month: 'numeric',
                        day: 'numeric',
                        weekday: 'short',
                      })}
                    </span>
                    <span className={style.name}>{day.label}</span>
                    <span className={`${style.tag} ${day.source_day === null ? style.tagOff : ''}`}>
                      {day.source_day === null
                        ? t('off')
                        : t('makeupOf', { day: weekdayName(day.source_day) })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className={style.hint}>{t('importHint')}</p>

          <div className={style.form_actions}>
            <Button
              variant="secondary"
              className={style.pushStart}
              onClick={runImport}
              disabled={importing}
            >
              {importing ? t('importing') : t('import')}
            </Button>
            <Button onClick={() => setForm({ date: '', source: OFF, label: '' })}>
              {t('new')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
