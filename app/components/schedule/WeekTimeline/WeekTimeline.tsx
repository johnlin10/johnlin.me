'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent,
} from 'react'
import { useFormatter } from 'next-intl'
import { courseColorStyle } from '@/app/lib/schedule/colors'
import ExpandPopup from '@/app/components/ExpandPopup/ExpandPopup'
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

// 那一天的注記：放假或補課，畫在欄頭上；off 的整欄灰掉，也不能點
export type DayNote = { text: string; off: boolean }

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
  // 忙碌時段的深淺，0–1，越多人在忙越深；不給是一個人的預設深度
  shade?: number
  // 忙碌時段能不能點（交給 onItemClick）；輔導時段一律能點或滑過放大
  clickable?: boolean
  // 放大後才看得到的補充，一行一項（地點、指導老師）
  details?: string[]
}

// 完善就學的規定是週末不能排，週末畫出來也只是佔掉五天的寬度
const DAYS = [1, 2, 3, 4, 5]

const SPAN = DAY_END - DAY_START
// 半小時一格，格線和可以點的空白都是這些格子
const CELLS = SPAN / STEP

// 滑鼠停在輔導時段上這麼久（ms）才放大，掃過去不會一路跳出來
const HOVER_DELAY = 200

// 手指拖超過這個距離（px）放開才換週
const SWIPE_THRESHOLD = 60
// 換週時整週滑動的距離，相對於五天的總寬
const SLIDE = 40

/**
 * 週時間軸：週一到週五各一欄，縱軸是 08:00–22:00 的實際時間。
 * 輔導時段照顏色畫、重疊就並排；忙碌時段鋪滿整欄墊在底下，沒有灰塊的地方就是有空。
 * 外框設了 --session-inset 的話，輔導時段左邊讓出這麼寬，露出底下的灰塊。
 * @param props.weekStart 這一週的週一
 * @param props.items 要畫的時段
 * @param props.dayNotes 日期 → 放假或補課的注記，沒有的日子照常
 * @param props.onItemClick 點時段時呼叫
 * @param props.expand 輔導時段怎麼放大成浮層：'hover' 滑過放大、點了交給 onItemClick；'click' 點了放大
 * @param props.onEmptyClick 點空白時呼叫，帶那一格的日期和時間，不給就不能點
 * @param props.onPrev 手指往右滑時呼叫，不給就滑不過去
 * @param props.onNext 手指往左滑時呼叫，不給就滑不過去
 * @param props.className 外框的額外 class
 */
export default function WeekTimeline({
  weekStart,
  items,
  dayNotes,
  onItemClick,
  expand = 'click',
  onEmptyClick,
  onPrev,
  onNext,
  className = '',
}: {
  weekStart: Date
  items: TimelineItem[]
  dayNotes?: Map<string, DayNote>
  onItemClick?: (id: string) => void
  expand?: 'hover' | 'click'
  onEmptyClick?: (date: string, time: string) => void
  onPrev?: () => void
  onNext?: () => void
  className?: string
}) {
  const format = useFormatter()
  // SSR 算的「今天」可能跟瀏覽器差一天（伺服器是 UTC），所以只在瀏覽器上算
  const today = useSyncExternalStore(
    () => () => {},
    () => dateKey(new Date()),
    () => '',
  )

  // 放大的是哪一塊；關掉時留著，縮回去的動畫還要用
  const [expanded, setExpanded] = useState<{ id: string; el: HTMLElement } | null>(null)
  const [expandOpen, setExpandOpen] = useState(false)
  const hoverTimer = useRef<number | undefined>(undefined)
  const closeExpand = useCallback(() => setExpandOpen(false), [])
  const openExpand = (id: string, el: HTMLElement) => {
    setExpanded({ id, el })
    setExpandOpen(true)
  }
  useEffect(() => () => window.clearTimeout(hoverTimer.current), [])

  const daysRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    x: number
    y: number
    dx: number
    moving: boolean
  } | null>(null)
  // 拖過就不算點擊，不然放開時會打開底下那一格
  const dragged = useRef(false)
  const week = weekStart.getTime()
  const shownWeek = useRef(week)

  // 換週（滑動、點週次、換月份都算）就從那個方向滑進來
  useLayoutEffect(() => {
    const node = daysRef.current
    const before = shownWeek.current
    shownWeek.current = week
    if (!node || before === shownWeek.current) return
    node.getAnimations().forEach((animation) => animation.cancel())
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const from = shownWeek.current > before ? SLIDE : -SLIDE
    node.animate(
      [
        { transform: `translateX(${from}%)`, opacity: 0 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
    )
  }, [week])

  // 只接手指；滑鼠和觸控板有週次選擇器可以點
  const onPointerDown = (event: PointerEvent) => {
    dragged.current = false
    if (event.pointerType !== 'touch' || !event.isPrimary) return
    drag.current = { x: event.clientX, y: event.clientY, dx: 0, moving: false }
  }

  const onPointerMove = (event: PointerEvent) => {
    const state = drag.current
    const node = daysRef.current
    if (!state || !node) return
    const dx = event.clientX - state.x
    if (!state.moving) {
      // 先確定是橫著滑；直的交給頁面捲動（touch-action 會讓瀏覽器送 pointercancel）
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(event.clientY - state.y)) return
      state.moving = true
      dragged.current = true
      node.getAnimations().forEach((animation) => animation.cancel())
    }
    // 沒有上一週或下一週就拉不太動
    state.dx = (dx > 0 ? onPrev : onNext) ? dx : dx / 4
    node.style.transform = `translateX(${state.dx}px)`
  }

  const onPointerEnd = (event: PointerEvent) => {
    const state = drag.current
    const node = daysRef.current
    drag.current = null
    if (!state?.moving || !node) return
    node.style.transform = ''
    const go = state.dx > 0 ? onPrev : onNext
    const commit = event.type === 'pointerup' && Math.abs(state.dx) > SWIPE_THRESHOLD && go
    const from = { transform: `translateX(${state.dx}px)` }
    if (!commit) {
      node.animate([from, { transform: 'none' }], {
        duration: 180,
        easing: 'ease-out',
      })
      return
    }
    // 停在滑出去的位置，等新的一週畫出來，由上面的 layout effect 接手滑進來
    node
      .animate(
        [
          from,
          {
            transform: `translateX(${state.dx > 0 ? SLIDE : -SLIDE}%)`,
            opacity: 0,
          },
        ],
        { duration: 120, easing: 'ease-in', fill: 'forwards' },
      )
      .finished.then(go, () => {})
  }

  /**
   * 區塊裡的字。放大後的浮層用同一份，多畫結束時間和補充，不截字。
   * @param item 時段
   * @param full 放大後的版本
   */
  const itemContent = (item: TimelineItem, full = false) => {
    const start = timeLabel(minutesOf(item.start))
    const end = timeLabel(minutesOf(item.end))
    return (
      <>
        <span className={style.itemTime}>
          {start}
          <span className={full ? '' : style.itemEnd}>–{end}</span>
          {item.badge && <span className={style.itemBadge}>{item.badge}</span>}
        </span>
        <span className={style.itemTitle}>{item.title}</span>
        {item.meta && <span className={style.itemMeta}>{item.meta}</span>}
        {full &&
          item.details?.map((line) => (
            <span key={line} className={style.itemDetail}>
              {line}
            </span>
          ))}
      </>
    )
  }

  // 換週之後原本那塊不在了，浮層跟著收掉
  const expandedItem = expanded ? items.find((item) => item.id === expanded.id) : undefined

  const days = DAYS.map((day) => addDays(weekStart, day - 1))
  const hours = Array.from({ length: SPAN / 60 }, (_, i) => DAY_START + i * 60)

  return (
    <div className={`${style.timeline} ${className}`}>
      <div className={style.corner} />
      <div className={style.axis}>
        {hours.map((minute) => (
          <span key={minute} className={style.hour}>
            {timeLabel(minute)}
          </span>
        ))}
      </div>

      <div
        ref={daysRef}
        className={style.days}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={(event) => {
          if (!dragged.current) return
          dragged.current = false
          event.stopPropagation()
        }}
      >
        {days.map((date) => {
          const note = dayNotes?.get(dateKey(date))
          return (
            <div
              key={date.getTime()}
              className={`${style.dayHead} ${dateKey(date) === today ? style.today : ''} ${
                note?.off ? style.offHead : ''
              }`}
            >
              <span className={style.dayName}>{format.dateTime(date, { weekday: 'short' })}</span>
              <span className={style.dayDate}>
                {format.dateTime(date, { month: 'numeric', day: 'numeric' })}
              </span>
              {note && (
                <span className={style.dayNote} title={note.text}>
                  {note.text}
                </span>
              )}
            </div>
          )
        })}

        {days.map((date, index) => {
          const day = index + 1
          const dayItems = items.filter((item) => item.day === day)
          const lanes = layoutLanes(dayItems.filter((item) => !item.muted))
          const off = dayNotes?.get(dateKey(date))?.off ?? false

          return (
            <div key={date.getTime()} className={`${style.column} ${off ? style.off : ''}`}>
              {Array.from({ length: CELLS }, (_, cell) => {
                const time = timeLabel(DAY_START + cell * STEP)
                return onEmptyClick && !off ? (
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
                const { lane, lanes: count } = lanes.get(item.id) ?? {
                  lane: 0,
                  lanes: 1,
                }
                const props = {
                  className: `${style.item} ${item.muted ? style.muted : ''}`,
                  // 輔導時段放大就看得到全部，不需要原生提示
                  title: item.muted
                    ? [item.title, `${item.start.slice(0, 5)}–${item.end.slice(0, 5)}`, item.meta]
                        .filter(Boolean)
                        .join(' · ')
                    : undefined,
                  style: {
                    top: `${((top - DAY_START) / SPAN) * 100}%`,
                    height: `${((bottom - top) / SPAN) * 100}%`,
                    ...(item.muted
                      ? { '--shade': item.shade }
                      : {
                          left: `calc(var(--session-inset, 0px) + (100% - var(--session-inset, 0px)) * ${lane / count})`,
                          width: `calc((100% - var(--session-inset, 0px)) / ${count})`,
                        }),
                    ...courseColorStyle(item.muted ? 'gray' : item.color),
                  } as CSSProperties,
                }

                if (item.muted) {
                  return onItemClick && item.clickable ? (
                    <button
                      key={item.id}
                      type="button"
                      {...props}
                      onClick={() => onItemClick(item.id)}
                    >
                      {itemContent(item)}
                    </button>
                  ) : (
                    <div key={item.id} {...props}>
                      {itemContent(item)}
                    </div>
                  )
                }

                const isOpen = expandOpen && expanded?.id === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    {...props}
                    aria-expanded={expand === 'click' ? isOpen : undefined}
                    onPointerEnter={(event) => {
                      if (expand !== 'hover' || event.pointerType !== 'mouse') return
                      const el = event.currentTarget
                      window.clearTimeout(hoverTimer.current)
                      hoverTimer.current = window.setTimeout(
                        () => openExpand(item.id, el),
                        HOVER_DELAY,
                      )
                    }}
                    onPointerLeave={() => window.clearTimeout(hoverTimer.current)}
                    onClick={(event) => {
                      if (expand === 'hover') {
                        window.clearTimeout(hoverTimer.current)
                        onItemClick?.(item.id)
                      } else if (isOpen) {
                        closeExpand()
                      } else {
                        openExpand(item.id, event.currentTarget)
                      }
                    }}
                  >
                    {itemContent(item)}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      <ExpandPopup
        open={expandOpen && Boolean(expandedItem)}
        anchor={expanded?.el ?? null}
        onClose={closeExpand}
        minWidth={200}
        label={expandedItem?.title}
        className={`${style.item} ${style.expanded}`}
        style={courseColorStyle(expandedItem?.color ?? null) as CSSProperties}
        onClick={
          expand === 'hover' && onItemClick && expandedItem
            ? () => {
                closeExpand()
                onItemClick(expandedItem.id)
              }
            : undefined
        }
        onPointerLeave={
          expand === 'hover'
            ? (event) => {
                if (event.pointerType === 'mouse') closeExpand()
              }
            : undefined
        }
      >
        {expandedItem && itemContent(expandedItem, true)}
      </ExpandPopup>
    </div>
  )
}
