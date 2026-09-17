'use client'

import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from 'react'
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
  monthOfWeek,
  programColor,
  shiftMonth,
  slotInEffect,
  sumHours,
  weeksOfMonth,
  type Term,
} from '@/app/lib/tutoring'
import WeekTimeline, { type TimelineItem } from '../WeekTimeline/WeekTimeline'
import style from './TutoringBoard.module.scss'

/**
 * 月份和週次的狀態。預設停在今天那個月、今天那一週。
 * @param bounds 可以選的最早和最晚月份 'YYYY-MM'，不給就是今天前後一年
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
    pickedWeek ??
      Math.max(
        0,
        weeks.findIndex((week) => dateKey(addDays(week, 6)) >= today),
      ),
    Math.max(weeks.length - 1, 0),
  )
  // 週末不能排，所以一週只看週一到週五
  const weekDates = weeks.length
    ? Array.from({ length: 5 }, (_, i) => dateKey(addDays(weeks[weekIndex], i)))
    : []

  const min = bounds?.min ?? (month && shiftMonth(today.slice(0, 7), -12))
  const max = bounds?.max ?? (month && shiftMonth(today.slice(0, 7), 12))
  const months: string[] = []
  for (let item = min; month && item <= max; item = shiftMonth(item, 1)) months.push(item)

  // 前後一週。跨月的那一週不管從哪邊滑進去都歸同一個月，底下的時數才不會來回跳
  const shiftWeek = (delta: number) => {
    if (!weeks.length) return undefined
    const target = addDays(weeks[weekIndex], 7 * delta)
    // 歸屬的月份超出範圍的話，退而停在範圍內另一個列得到它的月份
    const next = [monthOfWeek(target), month, shiftMonth(month, delta)]
      .filter((item) => item >= min && item <= max)
      .map((item) => ({
        month: item,
        index: weeksOfMonth(item).findIndex((week) => dateKey(week) === dateKey(target)),
      }))
      .find((item) => item.index >= 0)
    if (!next) return undefined
    return () => {
      setPickedMonth(next.month)
      setPickedWeek(next.index)
    }
  }

  return {
    today,
    month,
    months,
    weeks,
    weekIndex,
    weekDates,
    prevWeek: shiftWeek(-1),
    nextWeek: shiftWeek(1),
    setWeek: setPickedWeek,
    // 新的月份也列得到目前這一週就留在原地，只換底下統計的月份
    setMonth: (next: string) => {
      const current = weeks.length ? dateKey(weeks[weekIndex]) : ''
      const index = weeksOfMonth(next).findIndex((week) => dateKey(week) === current)
      setPickedMonth(next)
      setPickedWeek(index >= 0 ? index : null)
    },
  }
}

export type WeekPickerState = ReturnType<typeof useWeekPicker>

/**
 * 月份的名稱，今年的不寫年份。
 * @param format useFormatter 的回傳值
 * @param month 'YYYY-MM'
 * @param today 'YYYY-MM-DD'
 * @returns 例如「10月」「2027年1月」
 */
function monthLabel(format: ReturnType<typeof useFormatter>, month: string, today: string) {
  return format.dateTime(
    new Date(`${month}-01T12:00:00`),
    month.slice(0, 4) === today.slice(0, 4)
      ? { month: 'long' }
      : { year: 'numeric', month: 'long' },
  )
}

/**
 * 置中的滾動選擇器：捲到哪一格就選哪一格。
 * @param props.items 每一格的 key 和文字
 * @param props.index 選中的是第幾格
 * @param props.onPick 捲動停下或點擊時呼叫，帶第幾格
 * @param props.label 無障礙名稱
 * @param props.className 外框的額外 class
 */
function SnapTabs({
  items,
  index,
  onPick,
  label,
  className = '',
}: {
  items: { key: string; label: string }[]
  index: number
  onPick: (index: number) => void
  label: string
  className?: string
}) {
  const list = useRef<HTMLDivElement>(null)
  const scrollTimer = useRef<number | undefined>(undefined)
  const keys = items.map((item) => item.key).join()
  const shownKeys = useRef('')

  // 選中的換了就捲到中間；整排換掉（換月份、第一次出現）直接跳過去，不用滑
  useEffect(() => {
    const node = list.current?.children[index]
    if (list.current && node) {
      // 不用 scrollIntoView：月份和週次同時捲的話，Chrome 會讓後一個打斷前一個
      const listRect = list.current.getBoundingClientRect()
      const rect = node.getBoundingClientRect()
      list.current.scrollTo({
        left:
          list.current.scrollLeft + rect.left + rect.width / 2 - listRect.left - listRect.width / 2,
        behavior: shownKeys.current === keys ? 'smooth' : 'instant',
      })
    }
    shownKeys.current = keys
  }, [index, keys])

  // 停在哪一格就選哪一格。捲動中途不動，不然時間軸會跟著抖
  const onScroll = () => {
    window.clearTimeout(scrollTimer.current)
    scrollTimer.current = window.setTimeout(() => {
      if (!list.current) return
      // 用螢幕座標比，不用 offsetLeft —— 它是相對於定位父層，不是這個捲動容器
      const listRect = list.current.getBoundingClientRect()
      const center = listRect.left + listRect.width / 2
      let nearest = 0
      let best = Infinity
      Array.from(list.current.children).forEach((child, i) => {
        const rect = child.getBoundingClientRect()
        const distance = Math.abs(rect.left + rect.width / 2 - center)
        if (distance < best) {
          best = distance
          nearest = i
        }
      })
      // 程式捲過去的也會觸發；同一格不再選一次，換月份那種會把週次重設
      if (nearest !== index) onPick(nearest)
    }, 120)
  }

  return (
    <div
      ref={list}
      className={`${style.tabs} ${className}`}
      role="tablist"
      aria-label={label}
      onScroll={onScroll}
    >
      {items.map((item, i) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          aria-selected={i === index}
          className={`${style.tab} ${i === index ? style.tabActive : ''}`}
          onClick={() => onPick(i)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

/**
 * 月份和週次兩排滾動選擇器。
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
  const { month, months, weeks, weekIndex } = picker
  if (!month) return null

  return (
    <div className={`${style.picker} ${className}`}>
      <SnapTabs
        items={months.map((item) => ({
          key: item,
          label: monthLabel(format, item, picker.today),
        }))}
        index={months.indexOf(month)}
        onPick={(index) => picker.setMonth(months[index])}
        label={t('month.label')}
        className={style.monthTabs}
      />
      <SnapTabs
        items={weeks.map((week) => ({
          key: dateKey(week),
          label: `${format.dateTime(week, { month: 'numeric', day: 'numeric' })}–${format.dateTime(
            addDays(week, 4),
            { month: 'numeric', day: 'numeric' },
          )}`,
        }))}
        index={weekIndex}
        onPick={picker.setWeek}
        label={t('week.label')}
      />
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
 * @param props.pickMe 後台用：一進來疊上自己的課表，自己跟其他人中間畫線；分享頁不給，讓看的人自己選
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
  pickMe = false,
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
  pickMe?: boolean
}) {
  const t = useTranslations('ToolsPage.tutoring')
  const format = useFormatter()
  // 一次只疊一個人的課表；分左右欄會跟「不同天也是左右排」混在一起
  const [overlay, setOverlay] = useState(() =>
    pickMe ? (people.find((person) => person.is_me)?.id ?? '') : '',
  )
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
          onPrev={picker.prevWeek}
          onNext={picker.nextWeek}
          className={style.timeline}
        />

        {people.length > 0 && (
          <div className={style.overlayBar}>
            <span className={style.overlayLabel}>{t('overlay.title')}</span>
            {people.map((person) => (
              <Fragment key={person.id}>
                <button
                  type="button"
                  aria-pressed={overlay === person.id}
                  className={`${style.chip} ${overlay === person.id ? style.chipOn : ''}`}
                  onClick={() => setOverlay(overlay === person.id ? '' : person.id)}
                >
                  {person.name}
                </button>
                {pickMe && person.is_me && <span className={style.chipDivider} aria-hidden />}
              </Fragment>
            ))}
          </div>
        )}
      </div>

      {children}

      {students.length > 0 && (
        <div>
          {/* 滑到跨月的那一週，月份會自動換，標出來才不會看錯 */}
          <h2 className={style.hoursTitle}>
            {t('hours.title', { month: monthLabel(format, month, picker.today) })}
          </h2>
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
