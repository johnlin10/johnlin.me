'use client'

import type { CSSProperties } from 'react'
import { useFormatter } from 'next-intl'
import { PERIODS, periodIndex } from '@/app/lib/schedule/periods'
import { courseColorStyle } from '@/app/lib/schedule/colors'
import style from './ScheduleGrid.module.scss'

export type GridSlot = {
  id: string
  day: number
  start: string
  end: string
  course: string | null
  teacher: string | null
  location: string | null
  color: string | null
}

const WEEKDAYS = [1, 2, 3, 4, 5]

/**
 * 週課表網格：列是節次、欄是星期，週六日有時段才多出那一欄。
 * 欄位是 null 就不顯示；course 是 null 時畫成灰色色塊，文字用 busyLabel。
 * @param props.slots 要畫的時段
 * @param props.busyLabel course 是 null 時色塊上的文字
 * @param props.onCellClick 點空格時呼叫，不給就不能點
 * @param props.onSlotClick 點時段時呼叫，不給就不能點
 * @param props.className 外框的額外 class
 */
export default function ScheduleGrid({
  slots,
  busyLabel,
  onCellClick,
  onSlotClick,
  className = '',
}: {
  slots: GridSlot[]
  busyLabel: string
  onCellClick?: (day: number, period: string) => void
  onSlotClick?: (id: string) => void
  className?: string
}) {
  const format = useFormatter()
  const days = [...WEEKDAYS, ...[6, 7].filter((day) => slots.some((slot) => slot.day === day))]
  // 2024-01-01 是週一
  const dayNames = days.map((day) =>
    format.dateTime(new Date(2024, 0, day, 12), { weekday: 'short' }),
  )

  return (
    <div
      className={`${style.grid} ${className}`}
      style={{ '--days': days.length, '--periods': PERIODS.length } as CSSProperties}
    >
      <div className={style.corner} />
      {dayNames.map((name, col) => (
        <div key={name} className={style.dayHead} style={{ gridColumn: col + 2 }}>
          {name}
        </div>
      ))}

      {PERIODS.map((period, row) => (
        <div key={period.code} className={style.periodHead} style={{ gridRow: row + 2 }}>
          <span className={style.periodCode}>{period.code}</span>
          <span className={style.periodTime}>{period.start}</span>
        </div>
      ))}

      {days.flatMap((day, col) =>
        PERIODS.map((period, row) => {
          const position = { gridColumn: col + 2, gridRow: row + 2 }
          return onCellClick ? (
            <button
              key={`${day}-${period.code}`}
              type="button"
              className={style.cell}
              style={position}
              aria-label={`${dayNames[col]} ${period.code}`}
              onClick={() => onCellClick(day, period.code)}
            />
          ) : (
            <div key={`${day}-${period.code}`} className={style.cell} style={position} />
          )
        }),
      )}

      {slots.map((slot) => {
        const top = periodIndex(slot.start)
        const bottom = periodIndex(slot.end)
        if (top < 0 || bottom < top) return null
        const text = [slot.course ?? busyLabel, slot.teacher, slot.location]
          .filter(Boolean)
          .join(' · ')
        const props = {
          className: style.slot,
          title: text,
          style: {
            gridColumn: days.indexOf(slot.day) + 2,
            gridRow: `${top + 2} / ${bottom + 3}`,
            ...courseColorStyle(slot.course === null ? 'gray' : slot.color),
          },
        }
        const content = (
          <>
            <span className={style.time}>{PERIODS[top].start}</span>
            <span className={style.course}>{slot.course ?? busyLabel}</span>
            {slot.teacher && <span className={style.meta}>{slot.teacher}</span>}
            {slot.location && <span className={style.meta}>{slot.location}</span>}
          </>
        )
        return onSlotClick ? (
          <button key={slot.id} type="button" {...props} onClick={() => onSlotClick(slot.id)}>
            {content}
          </button>
        ) : (
          <div key={slot.id} {...props}>
            {content}
          </div>
        )
      })}
    </div>
  )
}
