import type { CSSProperties } from 'react'
import { courseColorStyle } from '@/app/lib/schedule/colors'
import { layoutLanes, minutesOf } from '@/app/lib/tutoring'
import style from './DayTimeline.module.scss'

export type DayItem = {
  id: string
  start: string // 'HH:MM'
  end: string
  title: string
  meta: string
  color: string
  // 今天已經結束的淡掉
  done?: boolean
}

// 一小時的高度（rem）；50 分鐘的一節課也放得下標題和時間兩行
export const HOUR_REM = 3.5

/**
 * 時間軸涵蓋的整點範圍：第一件行程的開始往前取整，最後一件的結束往後取整。
 * @param items 這一天的行程
 * @returns 起訖的小時
 */
export function hourRange(items: { start: string; end: string }[]) {
  return {
    first: Math.floor(Math.min(...items.map((item) => minutesOf(item.start))) / 60),
    last: Math.ceil(Math.max(...items.map((item) => minutesOf(item.end))) / 60),
  }
}

/**
 * 單日時間軸：縱軸只涵蓋第一件到最後一件行程的整點範圍，時段依長短畫成色塊，重疊就並排。
 * 不需要互動，伺服器端畫完就好。
 * @param props.items 這一天的行程
 * @param props.now 現在時間 'HH:MM'；給了而且落在範圍內就畫一條線
 */
export default function DayTimeline({ items, now }: { items: DayItem[]; now?: string }) {
  const { first, last } = hourRange(items)
  const from = first * 60
  const span = (last - first) * 60
  const at = (minutes: number) => `${((minutes - from) / span) * 100}%`
  const lanes = layoutLanes(items)
  const nowMinutes = now ? minutesOf(now) : -1

  return (
    <div className={style.timeline} style={{ height: `${(last - first) * HOUR_REM}rem` }}>
      {Array.from({ length: last - first + 1 }, (_, index) => (
        <span key={index} className={style.hour} style={{ top: at(from + index * 60) }}>
          {String(first + index).padStart(2, '0')}:00
        </span>
      ))}

      <div className={style.track}>
        {Array.from({ length: last - first + 1 }, (_, index) => (
          <span key={index} className={style.line} style={{ top: at(from + index * 60) }} />
        ))}

        {items.map((item) => {
          const { lane, lanes: count } = lanes.get(item.id) ?? { lane: 0, lanes: 1 }
          const start = minutesOf(item.start)
          return (
            <div
              key={item.id}
              className={`${style.item} ${item.done ? style.done : ''}`}
              style={
                {
                  top: at(start),
                  height: `${((minutesOf(item.end) - start) / span) * 100}%`,
                  left: `${(lane / count) * 100}%`,
                  width: `${100 / count}%`,
                  ...courseColorStyle(item.color),
                } as CSSProperties
              }
            >
              <span className={style.title}>{item.title}</span>
              <span className={style.meta}>
                {[`${item.start}–${item.end}`, item.meta].filter(Boolean).join(' · ')}
              </span>
            </div>
          )
        })}

        {nowMinutes > from && nowMinutes < from + span && (
          <span className={style.now} style={{ top: at(nowMinutes) }} data-now />
        )}
      </div>
    </div>
  )
}
