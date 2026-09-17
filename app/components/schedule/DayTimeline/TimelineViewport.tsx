'use client'

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { HOUR_REM } from './DayTimeline'
import style from './TimelineViewport.module.scss'

// 收合時的高度，大約四個小時
const COLLAPSED_REM = 15
// 時間軸上下的留白，整點標籤才不會被切掉
const PAD_REM = 0.5
// 上下淡出的長度；收合時現在時間那條線對齊上方淡出的盡頭
const FADE_REM = 3
// 停止捲動多久後回到現在時間
const IDLE_MS = 3000
const DURATION = 420
const EASING = 'cubic-bezier(0.2, 0, 0, 1)'

/**
 * 包住 DayTimeline 的整個區塊：收合時只露出從 topRem 開始的一段，上下還有內容就淡出；
 * 可以捲，停下 3 秒捲回 topRem；
 * 點區塊任何地方展開成全天，從目前捲到的位置接著長開，再點一次收回去。
 * @param props.header 區塊標題，不跟著捲
 * @param props.hours 時間軸涵蓋幾個小時
 * @param props.topRem 收合時頂端對齊的位置，從時間軸頂端算起（rem）；今天是現在時間，其他天是 0
 * @param props.className 區塊外框的 class
 * @param props.children DayTimeline
 */
export default function TimelineViewport({
  header,
  hours,
  topRem,
  className,
  children,
}: {
  header: ReactNode
  hours: number
  topRem: number
  className?: string
  children: ReactNode
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const idle = useRef<number>(undefined)
  const [ready, setReady] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const fullRem = hours * HOUR_REM + PAD_REM * 2
  const collapsible = fullRem > COLLAPSED_REM
  // 收合時捲到哪：topRem 落在上方淡出的盡頭
  const anchorRem = Math.max(0, topRem + PAD_REM - FADE_REM)
  // JS 還沒跑之前先用位移頂上去，一載入就是現在時間在上面，不會從頭跳過來
  const shiftRem = Math.min(anchorRem, Math.max(0, fullRem - COLLAPSED_REM))

  const anchorPx = () =>
    anchorRem * parseFloat(getComputedStyle(document.documentElement).fontSize)

  const updateFade = () => {
    const el = scroller.current
    if (!el) return
    el.dataset.before = String(el.scrollTop > 1)
    el.dataset.more = String(el.scrollTop + el.clientHeight < el.scrollHeight - 1)
  }

  const scheduleReturn = () => {
    window.clearTimeout(idle.current)
    idle.current = window.setTimeout(() => {
      const el = scroller.current
      if (el && Math.abs(el.scrollTop - Math.min(anchorPx(), el.scrollHeight - el.clientHeight)) > 1) {
        el.scrollTo({ top: anchorPx(), behavior: 'smooth' })
      }
    }, IDLE_MS)
  }

  useLayoutEffect(() => {
    if (!collapsible || !scroller.current) return
    // 位移換成真正的捲動位置，同一個畫格裡完成
    scroller.current.scrollTop = anchorPx()
    setReady(true)
    updateFade()
    return () => window.clearTimeout(idle.current)
  }, [])

  const toggle = () => {
    const el = scroller.current
    const inner = content.current
    if (!collapsible || !el || !inner) return
    window.clearTimeout(idle.current)
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : DURATION
    const from = el.clientHeight

    if (!expanded) {
      const offset = el.scrollTop
      flushSync(() => setExpanded(true))
      el.scrollTop = 0
      el.animate([{ maxHeight: `${from}px` }, { maxHeight: `${el.scrollHeight}px` }], {
        duration,
        easing: EASING,
      })
      inner.animate([{ transform: `translateY(${-offset}px)` }, { transform: 'none' }], {
        duration,
        easing: EASING,
      })
    } else {
      flushSync(() => setExpanded(false))
      const to = el.clientHeight
      const target = Math.min(anchorPx(), el.scrollHeight - to)
      el.animate([{ maxHeight: `${from}px` }, { maxHeight: `${to}px` }], {
        duration,
        easing: EASING,
      })
      // 動畫期間框比內容高、捲不動，捲動位置會被歸零，所以先用位移收上去，結束才換成捲動
      const slide = inner.animate(
        [{ transform: 'none' }, { transform: `translateY(${-target}px)` }],
        { duration, easing: EASING, fill: 'forwards' },
      )
      slide.onfinish = () => {
        el.scrollTop = target
        slide.cancel()
        updateFade()
      }
    }
  }

  return (
    <section
      className={`${className ?? ''} ${collapsible ? style.clickable : ''}`}
      onClick={toggle}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          toggle()
        }
      }}
      role={collapsible ? 'button' : undefined}
      tabIndex={collapsible ? 0 : undefined}
      aria-expanded={collapsible ? expanded : undefined}
    >
      {header}
      <div
        ref={scroller}
        className={`${collapsible ? style.collapsible : ''} ${expanded ? style.expanded : ''}`}
        style={
          {
            '--collapsed': `${COLLAPSED_REM}rem`,
            '--pad': `${PAD_REM}rem`,
            '--fade': `${FADE_REM}rem`,
          } as CSSProperties
        }
        // 之後由 updateFade 直接改，這裡的值不再變，React 不會蓋掉
        data-before={collapsible ? String(shiftRem > 0) : undefined}
        data-more={collapsible ? 'true' : undefined}
        onScroll={() => {
          updateFade()
          if (!expanded) scheduleReturn()
        }}
        onTouchStart={() => window.clearTimeout(idle.current)}
        onTouchEnd={() => !expanded && scheduleReturn()}
      >
        <div
          ref={content}
          className={style.content}
          style={!ready && shiftRem > 0 ? { transform: `translateY(-${shiftRem}rem)` } : undefined}
        >
          {children}
        </div>
      </div>
    </section>
  )
}
