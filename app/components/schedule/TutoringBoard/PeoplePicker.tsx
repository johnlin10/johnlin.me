'use client'

import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useTranslations } from 'next-intl'
import type { Person } from '@/app/lib/supabase/tutoring'
import Popover from '@/app/components/admin/Popover/Popover'
import Icon from '@/app/components/Icon/Icon'
import selectStyle from '@/app/components/admin/Selector/Selector.module.scss'
import style from './TutoringBoard.module.scss'

// 滑鼠從按鈕移到面板要經過箭頭那段空隙，晚一點才收
const HOVER_CLOSE_DELAY = 150
// 按鈕上最多寫幾個名字，多的寫「等 N 人」
const SHOWN_NAMES = 3

/**
 * 藥丸按鈕寫著選了誰，滑鼠移上去或點一下彈出名單。
 * 滑鼠移開就收；點過就固定開著，點外面才收（手機只有這條路）。
 * 多選的名單最上面有「未選」和「全部」，全部就是每個人都選。
 * @param props.people 可以選的人，照這個順序列
 * @param props.value 選中的 id
 * @param props.onChange 選完的 id，照 people 的順序
 * @param props.multiple 多選；單選的話點一個就收起來
 * @param props.label 按鈕上名字前面的字，不給就只寫名字
 * @param props.ariaLabel 沒有 label 時的無障礙名稱
 */
export default function PeoplePicker({
  people,
  value,
  onChange,
  multiple = false,
  label,
  ariaLabel,
}: {
  people: Person[]
  value: string[]
  onChange: (ids: string[]) => void
  multiple?: boolean
  label?: string
  ariaLabel?: string
}) {
  const t = useTranslations('ToolsPage.tutoring.picker')
  const [open, setOpen] = useState<'hover' | 'pinned' | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<number | undefined>(undefined)

  // 點開的才把焦點移進名單：面板 portal 在 body 最後，不移的話鍵盤 Tab 不過去
  useEffect(() => {
    if (open === 'pinned') panel.current?.querySelector('button')?.focus()
  }, [open])

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  const chosen = people.filter((person) => value.includes(person.id))
  const names = chosen.slice(0, SHOWN_NAMES).map((person) => person.name).join(', ')
  const all = chosen.length > 0 && chosen.length === people.length
  const text = !chosen.length
    ? t('none')
    : all && multiple
      ? t('all')
      : chosen.length > SHOWN_NAMES
      ? t('more', { names, count: chosen.length })
      : names

  const onEnter = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return
    window.clearTimeout(closeTimer.current)
    setOpen((current) => current ?? 'hover')
  }

  const onLeave = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return
    closeTimer.current = window.setTimeout(
      () => setOpen((current) => (current === 'hover' ? null : current)),
      HOVER_CLOSE_DELAY,
    )
  }

  const pick = (id: string) => {
    if (!multiple) {
      onChange([id])
      setOpen(null)
      return
    }
    const next = value.includes(id) ? value.filter((item) => item !== id) : [...value, id]
    onChange(people.filter((person) => next.includes(person.id)).map((person) => person.id))
  }

  const option = (key: string, name: string, active: boolean, onClick: () => void) => (
    <li key={key}>
      <button
        type="button"
        aria-pressed={active}
        className={`${selectStyle.option} ${style.pickerOption} ${active ? selectStyle.option_active : ''}`}
        onClick={onClick}
      >
        {name}
        {active && <Icon name="check" size="xs" />}
      </button>
    </li>
  )

  const groups = [
    { key: 'student', people: people.filter((person) => person.role === 'student') },
    { key: 'teacher', people: people.filter((person) => person.role === 'teacher') },
  ].filter((group) => group.people.length)

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`${style.chip} ${style.pickerTrigger} ${chosen.length ? style.chipOn : ''}`}
        aria-haspopup="true"
        aria-expanded={open !== null}
        aria-label={label ? undefined : ariaLabel}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
        onClick={() => setOpen((current) => (current === 'pinned' ? null : 'pinned'))}
      >
        <span className={style.pickerText}>
          {label ? t('value', { label, value: text }) : text}
        </span>
        <Icon name="chevron-down" size="xs" />
      </button>

      <Popover
        isOpen={open !== null}
        onClose={() => setOpen(null)}
        anchorRef={trigger}
        placement="bottom"
        width={200}
        className={selectStyle.select_popover}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
      >
        <div
          ref={panel}
          className={style.pickerPanel}
          onKeyDown={(event) => {
            // Popover 會自己收起來，焦點還給按鈕才不會掉回頁首
            if (event.key === 'Escape') trigger.current?.focus()
          }}
        >
          {multiple && (
            <ul className={selectStyle.option_list}>
              {option('none', t('none'), !chosen.length, () => onChange([]))}
              {option('all', t('all'), all, () => onChange(people.map((person) => person.id)))}
            </ul>
          )}
          {groups.map((group) => (
            <div key={group.key}>
              {groups.length > 1 && (
                <p className={style.pickerGroup}>{t(`groups.${group.key}`)}</p>
              )}
              <ul className={selectStyle.option_list}>
                {group.people.map((person) =>
                  option(person.id, person.name, value.includes(person.id), () =>
                    pick(person.id),
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>
      </Popover>
    </>
  )
}
