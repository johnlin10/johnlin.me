'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { courseColorStyle } from '@/app/lib/schedule/colors'
import { layoutLanes, minutesOf } from '@/app/lib/tutoring'
import { HOUR_REM, hourRange } from './range'
import style from './DayTimeline.module.scss'

export type DayItem = {
  id: string
  start: string // 'HH:MM'
  end: string
  title: string
  meta: string
  color: string
}

// 現在時間多久重算一次；只到分鐘，不用太密
const TICK_MS = 5000

/**
 * 現在時間，每 5 秒重算一次，整頁不用重新整理。
 * @param initial 伺服器算好的 'HH:MM'；沒給表示畫的不是今天，不用跑
 * @returns 'HH:MM'，或 undefined
 */
function useNow(initial?: string) {
  const [now, setNow] = useState(initial)
  useEffect(() => {
    if (!initial) return
    const id = setInterval(() => {
      setNow(
        new Date().toLocaleTimeString('sv-SE', {
          timeZone: 'Asia/Taipei',
          hour: '2-digit',
          minute: '2-digit',
        }),
      )
    }, TICK_MS)
    return () => clearInterval(id)
  }, [initial])
  return now
}

/**
 * 單日時間軸：縱軸只涵蓋第一件到最後一件行程的整點範圍，時段依長短畫成色塊，重疊就並排。
 * @param props.items 這一天的行程
 * @param props.now 現在時間 'HH:MM'；給了就畫線、淡掉結束的行程，之後每 5 秒自己更新
 */
export default function DayTimeline({
  items,
  now: initialNow,
}: {
  items: DayItem[]
  now?: string
}) {
  const now = useNow(initialNow)
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
              className={`${style.item} ${now && item.end <= now ? style.done : ''}`}
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
