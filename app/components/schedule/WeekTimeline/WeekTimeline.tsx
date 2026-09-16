'use client'

import { useSyncExternalStore, type CSSProperties } from 'react'
import { useFormatter } from 'next-intl'
import { courseColorStyle } from '@/app/lib/schedule/colors'
import {
  DAY_END,
  DAY_START,
  STEP,
  addDays,
  dateKey,
  layoutLanes,
  minutesOf,
  timeLabel,
} from '@/app/lib/tutoring'
import style from './WeekTimeline.module.scss'

export type TimelineItem = {
  id: string
  day: number // 1 = 週一 … 7 = 週日
  start: string
  end: string
  title: string
  meta?: string
  color: string | null
  // 忙碌時段：灰色、半透明、鋪滿整欄，墊在輔導時段底下
  muted?: boolean
  // 接在時間後面的補充（輔導時段放時數）
  badge?: string
}

// 完善就學的規定是週末不能排，週末畫出來也只是佔掉五天的寬度
const DAYS = [1, 2, 3, 4, 5]

const SPAN = DAY_END - DAY_START
// 半小時一格，格線和可以點的空白都是這些格子
const CELLS = SPAN / STEP

/**
 * 週時間軸：週一到週五各一欄，縱軸是 08:00–22:00 的實際時間。
 * 輔導時段照顏色畫、重疊就並排；忙碌時段鋪滿整欄墊在底下，沒有灰塊的地方就是有空。
 * @param props.weekStart 這一週的週一
 * @param props.items 要畫的時段
 * @param props.onItemClick 點時段時呼叫，不給就不能點
 * @param props.onEmptyClick 點空白時呼叫，帶那一格的日期和時間，不給就不能點
 * @param props.className 外框的額外 class
 */
export default function WeekTimeline({
  weekStart,
  items,
  onItemClick,
  onEmptyClick,
  className = '',
}: {
  weekStart: Date
  items: TimelineItem[]
  onItemClick?: (id: string) => void
  onEmptyClick?: (date: string, time: string) => void
  className?: string
}) {
  const format = useFormatter()
  // SSR 算的「今天」可能跟瀏覽器差一天（伺服器是 UTC），所以只在瀏覽器上算
  const today = useSyncExternalStore(
    () => () => {},
    () => dateKey(new Date()),
    () => '',
  )

  const days = DAYS.map((day) => addDays(weekStart, day - 1))
  const hours = Array.from({ length: SPAN / 60 }, (_, i) => DAY_START + i * 60)

  return (
    <div className={`${style.timeline} ${className}`}>
      <div className={style.corner} />
      {days.map((date) => (
        <div
          key={date.getTime()}
          className={`${style.dayHead} ${dateKey(date) === today ? style.today : ''}`}
        >
          <span className={style.dayName}>{format.dateTime(date, { weekday: 'short' })}</span>
          <span className={style.dayDate}>
            {format.dateTime(date, { month: 'numeric', day: 'numeric' })}
          </span>
        </div>
      ))}

      <div className={style.axis}>
        {hours.map((minute) => (
          <span key={minute} className={style.hour}>
            {timeLabel(minute)}
          </span>
        ))}
      </div>

      {days.map((date, index) => {
        const day = index + 1
        const dayItems = items.filter((item) => item.day === day)
        const lanes = layoutLanes(dayItems.filter((item) => !item.muted))

        return (
          <div key={date.getTime()} className={style.column}>
            {Array.from({ length: CELLS }, (_, cell) => {
              const time = timeLabel(DAY_START + cell * STEP)
              return onEmptyClick ? (
                <button
                  key={time}
                  type="button"
                  className={style.cell}
                  aria-label={`${format.dateTime(date, { month: 'numeric', day: 'numeric' })} ${time}`}
                  onClick={() => onEmptyClick(dateKey(date), time)}
                />
              ) : (
                <div key={time} className={style.cell} />
              )
            })}

            {dayItems.map((item) => {
              const top = Math.max(minutesOf(item.start), DAY_START)
              const bottom = Math.min(minutesOf(item.end), DAY_END)
              if (bottom <= top) return null
              const { lane, lanes: count } = lanes.get(item.id) ?? { lane: 0, lanes: 1 }
              const start = timeLabel(minutesOf(item.start))
              const end = timeLabel(minutesOf(item.end))
              const text = [item.title, `${start}–${end}`, item.badge, item.meta]
                .filter(Boolean)
                .join(' · ')
              const props = {
                className: `${style.item} ${item.muted ? style.muted : ''}`,
                title: text,
                style: {
                  top: `${((top - DAY_START) / SPAN) * 100}%`,
                  height: `${((bottom - top) / SPAN) * 100}%`,
                  ...(item.muted
                    ? {}
                    : { left: `${(lane / count) * 100}%`, width: `${100 / count}%` }),
                  ...courseColorStyle(item.muted ? 'gray' : item.color),
                } as CSSProperties,
              }
              const content = (
                <>
                  <span className={style.itemTime}>
                    {start}
                    <span className={style.itemEnd}>–{end}</span>
                    {item.badge && <span className={style.itemBadge}>{item.badge}</span>}
                  </span>
                  <span className={style.itemTitle}>{item.title}</span>
                  {item.meta && <span className={style.itemMeta}>{item.meta}</span>}
                </>
              )

              return onItemClick && !item.muted ? (
                <button key={item.id} type="button" {...props} onClick={() => onItemClick(item.id)}>
                  {content}
                </button>
              ) : (
                <div key={item.id} {...props}>
                  {content}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
