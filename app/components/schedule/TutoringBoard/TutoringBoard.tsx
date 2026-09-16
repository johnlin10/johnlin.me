'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import type { BusySlot, Person, PublicSession } from '@/app/lib/supabase/tutoring'
import {
  MONTHLY_CAP,
  PROGRAMS,
  addDays,
  dateKey,
  dayOfWeek,
  emptyHours,
  minutesOf,
  programColor,
  shiftMonth,
  slotInEffect,
  sumHours,
  weeksOfMonth,
  type Term,
} from '@/app/lib/tutoring'
import WeekTimeline, { type TimelineItem } from '../WeekTimeline/WeekTimeline'
import Icon from '@/app/components/Icon/Icon'
import style from './TutoringBoard.module.scss'

/**
 * 月份和週次的狀態。預設停在今天那個月、今天那一週。
 * @param bounds 可以翻到的最早和最晚月份 'YYYY-MM'，不給就不限
 */
export function useWeekPicker(bounds?: { min: string; max: string }) {
  // 伺服器是 UTC，跟瀏覽器可能差一天，所以「今天」只在瀏覽器上算
  const today = useSyncExternalStore(
    () => () => {},
    () => dateKey(new Date()),
    () => '',
  )
  const [pickedMonth, setPickedMonth] = useState('')
  const [pickedWeek, setPickedWeek] = useState<number | null>(null)

  const month = pickedMonth || today.slice(0, 7)
  const weeks = month ? weeksOfMonth(month) : []
  // 今天不在這個月就停在第一週
  const weekIndex = Math.min(
    pickedWeek ?? Math.max(0, weeks.findIndex((week) => dateKey(addDays(week, 6)) >= today)),
    Math.max(weeks.length - 1, 0),
  )
  // 週末不能排，所以一週只看週一到週五
  const weekDates = weeks.length
    ? Array.from({ length: 5 }, (_, i) => dateKey(addDays(weeks[weekIndex], i)))
    : []

  return {
    today,
    month,
    weeks,
    weekIndex,
    weekDates,
    canPrev: !bounds || month > bounds.min,
    canNext: !bounds || month < bounds.max,
    setWeek: setPickedWeek,
    changeMonth: (delta: number) => {
      setPickedMonth(shiftMonth(month, delta))
      setPickedWeek(null)
    },
  }
}

export type WeekPickerState = ReturnType<typeof useWeekPicker>

/**
 * 月份切換加上置中的週次滾動選擇器：捲到哪一格就是哪一週。
 * @param props.picker useWeekPicker 的回傳值
 * @param props.className 外框的額外 class
 */
export function WeekPicker({
  picker,
  className = '',
}: {
  picker: WeekPickerState
  className?: string
}) {
  const t = useTranslations('ToolsPage.tutoring')
  const format = useFormatter()
  const weekTabs = useRef<HTMLDivElement>(null)
  const scrollTimer = useRef<number | undefined>(undefined)
  const { month, weeks, weekIndex, setWeek } = picker

  const centerWeek = (index: number, smooth = true) => {
    const node = weekTabs.current?.children[index] as HTMLElement | undefined
    node?.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: smooth ? 'smooth' : 'instant',
    })
  }

  // 停在哪一格就選哪一週。捲動中途不動，不然時間軸會跟著抖
  const onScroll = () => {
    window.clearTimeout(scrollTimer.current)
    scrollTimer.current = window.setTimeout(() => {
      const list = weekTabs.current
      if (!list) return
      // 用螢幕座標比，不用 offsetLeft —— 它是相對於定位父層，不是這個捲動容器
      const listRect = list.getBoundingClientRect()
      const center = listRect.left + listRect.width / 2
      let nearest = 0
      let best = Infinity
      Array.from(list.children).forEach((child, index) => {
        const rect = child.getBoundingClientRect()
        const distance = Math.abs(rect.left + rect.width / 2 - center)
        if (distance < best) {
          best = distance
          nearest = index
        }
      })
      setWeek(nearest)
    }, 120)
  }

  // 換月份（或第一次出現）時，把該停的那一週擺到中間
  useEffect(() => {
    centerWeek(weekIndex, false)
  }, [month])

  if (!month) return null

  return (
    <div className={`${style.picker} ${className}`}>
      <div className={style.monthBar}>
        <button
          type="button"
          className={style.arrow}
          aria-label={t('month.prev')}
          disabled={!picker.canPrev}
          onClick={() => picker.changeMonth(-1)}
        >
          <Icon name="arrow-left" size="xs" />
        </button>
        <span className={style.monthLabel}>
          {format.dateTime(new Date(`${month}-01T12:00:00`), { year: 'numeric', month: 'long' })}
        </span>
        <button
          type="button"
          className={style.arrow}
          aria-label={t('month.next')}
          disabled={!picker.canNext}
          onClick={() => picker.changeMonth(1)}
        >
          <Icon name="arrow-right" size="xs" />
        </button>
      </div>

      <div
        ref={weekTabs}
        className={style.weekTabs}
        role="tablist"
        aria-label={t('week.label')}
        onScroll={onScroll}
      >
        {weeks.map((week, index) => (
          <button
            key={dateKey(week)}
            type="button"
            role="tab"
            aria-selected={index === weekIndex}
            className={`${style.weekTab} ${index === weekIndex ? style.weekTabActive : ''}`}
            onClick={() => {
              setWeek(index)
              centerWeek(index)
            }}
          >
            {format.dateTime(week, { month: 'numeric', day: 'numeric' })}–
            {format.dateTime(addDays(week, 4), { month: 'numeric', day: 'numeric' })}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * 完善就學的主畫面：週時間軸、疊課表比對、該月時數。編輯頁和公開頁共用。
 * @param props.picker useWeekPicker 的回傳值
 * @param props.people 全部成員
 * @param props.busy 所有人的忙碌時段，含課表換算來的
 * @param props.terms 全部學期，最新的排第一個
 * @param props.sessions 這個月前後的輔導時段
 * @param props.licenseHours 每人證照輔導的累計時數
 * @param props.onItemClick 點時段時呼叫，不給就不能點
 * @param props.onEmptyClick 點空白時呼叫，不給就不能點
 * @param props.children 放在時間軸和時數表之間
 */
export default function TutoringBoard({
  picker,
  people,
  busy,
  terms,
  sessions,
  licenseHours,
  onItemClick,
  onEmptyClick,
  children,
}: {
  picker: WeekPickerState
  people: Person[]
  busy: BusySlot[]
  terms: Term[]
  sessions: PublicSession[]
  licenseHours: Record<string, number>
  onItemClick?: (id: string) => void
  onEmptyClick?: (date: string, time: string) => void
  children?: React.ReactNode
}) {
  const t = useTranslations('ToolsPage.tutoring')
  // 一次只疊一個人的課表；分左右欄會跟「不同天也是左右排」混在一起
  const [overlay, setOverlay] = useState('')
  const { month, weeks, weekIndex, weekDates } = picker
  if (!month) return null

  const personById = new Map(people.map((person) => [person.id, person]))
  const students = people.filter((person) => person.role === 'student')
  // 照成員清單的順序排，不照加入的先後，同一群人每次都同一個順序
  const namesOf = (ids: string[]) =>
    people
      .filter((person) => ids.includes(person.id))
      .map((person) => person.name)
      .join('、')

  const items: TimelineItem[] = [
    ...busy
      .filter((slot) => {
        const date = weekDates[slot.day - 1]
        return (
          slot.person_id === overlay && !!date && slotInEffect(slot.semester_id, date, terms)
        )
      })
      .map((slot) => ({
        id: `busy-${slot.id}`,
        day: slot.day,
        start: slot.start_time,
        end: slot.end_time,
        title: personById.get(slot.person_id)?.name ?? '',
        meta: slot.label ?? undefined,
        color: null,
        muted: true,
      })),
    ...sessions
      .filter((session) => weekDates.includes(session.date))
      .map((session) => ({
        id: session.id,
        day: dayOfWeek(session.date),
        start: session.start_time,
        end: session.end_time,
        title: t(`programs.${session.program}`),
        badge: t('session.hoursBadge', {
          hours: (minutesOf(session.end_time) - minutesOf(session.start_time)) / 60,
        }),
        meta: namesOf(session.attendees) || undefined,
        color: programColor(session.program),
      })),
  ]

  const monthHours = sumHours(sessions.filter((session) => session.date.slice(0, 7) === month))
  const cappedPrograms = PROGRAMS.filter((program) => program.capped)

  return (
    <>
      <div className={style.board}>
        <WeekTimeline
          weekStart={weeks[weekIndex]}
          items={items}
          onItemClick={onItemClick}
          onEmptyClick={onEmptyClick}
          className={style.timeline}
        />

        {people.length > 0 && (
          <div className={style.overlayBar}>
            <span className={style.overlayLabel}>{t('overlay.title')}</span>
            {people.map((person) => (
              <button
                key={person.id}
                type="button"
                aria-pressed={overlay === person.id}
                className={`${style.chip} ${overlay === person.id ? style.chipOn : ''}`}
                onClick={() => setOverlay(overlay === person.id ? '' : person.id)}
              >
                {person.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {children}

      {students.length > 0 && (
        <div>
          <div className={style.hoursWrap}>
            <table className={style.hours}>
              <thead>
                <tr>
                  <th>{t('hours.person')}</th>
                  {cappedPrograms.map((program) => (
                    <th key={program.key}>{t(`programs.${program.key}`)}</th>
                  ))}
                  <th>{t('hours.total')}</th>
                  <th>{t('programs.license')}</th>
                </tr>
              </thead>
              <tbody>
                {students.map((person) => {
                  const row = monthHours.get(person.id) ?? emptyHours()
                  const total = licenseHours[person.id] ?? 0
                  const level =
                    row.capped > MONTHLY_CAP
                      ? style.over
                      : row.capped >= MONTHLY_CAP - 8
                        ? style.near
                        : ''
                  return (
                    <tr key={person.id}>
                      <td>{person.name}</td>
                      {cappedPrograms.map((program) => (
                        <td key={program.key}>{row[program.key] || '–'}</td>
                      ))}
                      <td className={level}>
                        <span className={style.totalValue}>
                          {row.capped} / {MONTHLY_CAP}
                        </span>
                        <span className={style.bar}>
                          <span
                            className={style.barFill}
                            style={{ width: `${Math.min((row.capped / MONTHLY_CAP) * 100, 100)}%` }}
                          />
                        </span>
                      </td>
                      <td>
                        {row.license || '–'} / {total || '–'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* 說明放在捲動區外面，不跟著表格一起左右捲走 */}
          <p className={style.hint}>{t('hours.note')}</p>
        </div>
      )}
    </>
  )
}
