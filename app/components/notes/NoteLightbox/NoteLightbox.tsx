'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AnimatePresence,
  motion,
  animate,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from 'motion/react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import Icon from '@/app/components/Icon/Icon'
import type { NoteImage } from '@/app/types/note'
import { NOTE_RATIO_FALLBACK, noteNaturalRatio } from '@/app/lib/notes/imageRatio'
import { useLightboxZoom } from './useLightboxZoom'
import style from './NoteLightbox.module.scss'

interface NoteLightboxProps {
  images: NoteImage[]
  index: number | null
  onIndexChange: (index: number) => void
  onClose: () => void
  onClosed?: () => void
  getOriginRect: (index: number) => DOMRect | null
  scrollOriginIntoView: (index: number) => void
}

const SWIPE_DISMISS_DISTANCE = 130
const SWIPE_DISMISS_VELOCITY = 700
const SWIPE_PAGE_RATIO = 0.22
const SWIPE_PAGE_VELOCITY = 450

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** 開場/退場的 FLIP 變形：從縮圖的實際 rect 算出要用什麼 x/y/scale/clip 才能「長成」全螢幕。 */
function computeFlip(rect: DOMRect | null, ratio: number) {
  if (!rect || typeof window === 'undefined') return null
  const vw = window.innerWidth
  const vh = window.innerHeight
  const tw = Math.min(vw, vh * ratio)
  const th = tw / ratio
  const s = Math.max(rect.width / tw, rect.height / th)
  const dx = rect.left + rect.width / 2 - vw / 2
  const dy = rect.top + rect.height / 2 - vh / 2
  const ix = (((tw - rect.width / s) / 2) / tw) * 100
  const iy = (((th - rect.height / s) / 2) / th) * 100
  return {
    x: dx,
    y: dy,
    scale: s,
    clipPath: `inset(${iy}% ${ix}% round ${12 / s}px)`,
  }
}

/**
 * 短文圖片全螢幕燈箱：左右滑動切換、下滑關閉、點外部關閉、雙指/雙擊縮放。
 * 狀態（開/關/目前第幾張）完全由呼叫端（NoteMedia）持有，這裡只負責呈現與手勢。
 */
export default function NoteLightbox({
  images,
  index,
  onIndexChange,
  onClose,
  onClosed,
  getOriginRect,
  scrollOriginIntoView,
}: NoteLightboxProps) {
  return (
    <AnimatePresence onExitComplete={onClosed}>
      {index !== null && (
        <NoteLightboxStage
          images={images}
          index={index}
          onIndexChange={onIndexChange}
          onClose={onClose}
          getOriginRect={getOriginRect}
          scrollOriginIntoView={scrollOriginIntoView}
        />
      )}
    </AnimatePresence>
  )
}

interface StageProps {
  images: NoteImage[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
  getOriginRect: (index: number) => DOMRect | null
  scrollOriginIntoView: (index: number) => void
}

function NoteLightboxStage({
  images,
  index,
  onIndexChange,
  onClose,
  getOriginRect,
  scrollOriginIntoView,
}: StageProps) {
  const t = useTranslations('NotesPage.lightbox')
  const reduce = useReducedMotion()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([])

  const trackX = useMotionValue(0)
  const dismissY = useMotionValue(0)
  const dragOpacity = useTransform(dismissY, [-300, 0, 300], [0.4, 1, 0.4])
  // 用 ref 而非 state：onDirectionLock 跟 onDragEnd 都是同一次手勢裡 Framer 的回呼，
  // 中間如果靠 setState 傳遞軸向，遇到很快的手勢時 React 可能還沒重新渲染、
  // onDragEnd 就先讀到舊值——ref 是同步寫入/讀取，不受渲染時機影響。
  const axisRef = useRef<'x' | 'y' | null>(null)
  const [measuredRatios, setMeasuredRatios] = useState<Record<number, number>>({})
  const [exitFlip, setExitFlip] = useState<ReturnType<typeof computeFlip>>(null)

  const zoom = useLightboxZoom(!!reduce)
  const { zoomed } = zoom

  const total = images.length
  const current = images[index]
  const caption = current?.alt?.trim()

  const trackWidth = () =>
    trackRef.current?.clientWidth ??
    (typeof window !== 'undefined' ? window.innerWidth : 0)

  function goTo(next: number) {
    onIndexChange(clamp(next, 0, total - 1))
  }

  function requestClose() {
    // 使用者在燈箱裡可能已經切換到跟「打開當下」不同的圖片，原本的縮圖
    // 也可能因為橫向捲動而不在原位。這裡先把目前這張捲回可見範圍再量測，
    // 用 state 把結果存起來給 exit 用——不能倚賴接下來的 render 現算，
    // 因為 index 一旦被上層設回 null，這個元件就從樹上被拿掉，不會再有
    // 下一次 render 了（AnimatePresence 的 exit 只認得上一次 render 的值）。
    scrollOriginIntoView(index)
    const rect = getOriginRect(index)
    const r = measuredRatios[index] ?? noteNaturalRatio(images[index]) ?? NOTE_RATIO_FALLBACK
    setExitFlip(computeFlip(rect, r))
    requestAnimationFrame(onClose)
  }

  //* ---------- body scroll lock + 初次開啟時把焦點放到關閉鍵（只做一次，換頁不搶焦點） ----------
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  //* ---------- 鍵盤：綁定要跟著 index 更新，才不會用到過期的 goTo 邊界 ----------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
      else if (e.key === 'ArrowLeft') goTo(index - 1)
      else if (e.key === 'ArrowRight') goTo(index + 1)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  //* ---------- iOS 系統捏合抑制：userScalable:false 對 iOS Safari 無效，需另外擋 ----------
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault()
    // iOS Safari 非標準的手勢事件，DOM lib 型別沒有定義，用字串陣列繞開
    const events = ['gesturestart', 'gesturechange', 'gestureend']
    events.forEach((ev) => document.addEventListener(ev, stop, { passive: false }))
    return () =>
      events.forEach((ev) => document.removeEventListener(ev, stop))
  }, [])

  //* ---------- 分頁位置：mount 時瞬間定位，之後跟著 index 變化才做動畫 ----------
  useLayoutEffect(() => {
    trackX.set(-index * trackWidth())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    zoom.reset()
    const controls = animate(
      trackX,
      -index * trackWidth(),
      reduce ? { duration: 0.01 } : { type: 'spring', stiffness: 320, damping: 38 }
    )
    thumbRefs.current[index]?.scrollIntoView({ inline: 'center', block: 'nearest' })
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  useEffect(() => {
    const onResize = () => trackX.set(-index * trackWidth())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const w = trackWidth()
    const axis = axisRef.current
    axisRef.current = null
    if (axis === 'x') {
      const dir = info.offset.x < 0 ? 1 : -1
      const paged =
        Math.abs(info.offset.x) > w * SWIPE_PAGE_RATIO ||
        Math.abs(info.velocity.x) > SWIPE_PAGE_VELOCITY
      goTo(index + (paged ? dir : 0))
    } else if (axis === 'y') {
      if (
        info.offset.y > SWIPE_DISMISS_DISTANCE ||
        info.velocity.y > SWIPE_DISMISS_VELOCITY
      ) {
        requestClose()
      } else {
        animate(dismissY, 0, { type: 'spring', stiffness: 400, damping: 40 })
      }
    }
  }

  //* ---------- FLIP 開闔 ----------
  const originRect = getOriginRect(index)
  const ratio = measuredRatios[index] ?? noteNaturalRatio(current) ?? NOTE_RATIO_FALLBACK
  const flip = useMemo(
    () => computeFlip(originRect, ratio),
    // originRect 是每次 render 現量的普通物件，用座標值本身做 memo key 更穩定
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [originRect?.left, originRect?.top, originRect?.width, originRect?.height, ratio]
  )

  const toStageTarget = (f: ReturnType<typeof computeFlip>) =>
    f
      ? { x: f.x, y: f.y, scale: f.scale, clipPath: f.clipPath, opacity: 1 }
      : { opacity: 0, scale: 0.94 }

  const stageInitial = toStageTarget(flip)
  // exitFlip 在 requestClose() 當下同步量測、寫入，理論上關閉時一定已經有值；
  // 萬一還沒有（例如元件被其他方式卸載），退回跟開場一樣的 flip 至少不會整個消失。
  const stageExit = toStageTarget(exitFlip ?? flip)
  const stageAnimate = {
    x: 0,
    y: 0,
    scale: 1,
    clipPath: 'inset(0% 0% round 0px)',
    opacity: 1,
  }
  const stageTransition = reduce
    ? { duration: 0.01 }
    : { duration: 0.32, ease: [0.23, 1, 0.32, 1] as const }
  const fadeTransition = { duration: reduce ? 0.01 : 0.2 }

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      <motion.div
        className={style.backdrop}
        onClick={requestClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={fadeTransition}
      />

      <motion.div
        className={style.stage}
        role="dialog"
        aria-modal="true"
        aria-label={t('label')}
        initial={stageInitial}
        animate={stageAnimate}
        exit={stageExit}
        transition={stageTransition}
      >
        <motion.div
          ref={trackRef}
          className={style.track}
          drag={!zoomed}
          dragDirectionLock
          onDirectionLock={(lockedAxis) => {
            axisRef.current = lockedAxis
          }}
          dragElastic={0.18}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
          style={{ x: trackX, y: dismissY, opacity: dragOpacity }}
        >
          {images.map((img, i) => {
            const isCurrent = i === index
            return (
              <div
                key={img.url}
                className={style.slide}
                ref={isCurrent ? zoom.bindContainer : undefined}
              >
                <motion.div
                  className={style.zoomLayer}
                  style={
                    isCurrent
                      ? { x: zoom.panX, y: zoom.panY, scale: zoom.scale }
                      : undefined
                  }
                  onPointerDown={isCurrent ? zoom.onPointerDown : undefined}
                  onPointerMove={isCurrent ? zoom.onPointerMove : undefined}
                  onPointerUp={isCurrent ? zoom.onPointerUp : undefined}
                  onPointerCancel={isCurrent ? zoom.onPointerCancel : undefined}
                >
                  <Image
                    src={img.url}
                    alt={img.alt ?? ''}
                    fill
                    sizes="100vw"
                    className={style.img}
                    priority={isCurrent}
                    onLoad={(e) => {
                      const el = e.currentTarget
                      if (el.naturalWidth && el.naturalHeight) {
                        setMeasuredRatios((prev) =>
                          prev[i]
                            ? prev
                            : { ...prev, [i]: el.naturalWidth / el.naturalHeight }
                        )
                      }
                    }}
                  />
                </motion.div>
              </div>
            )
          })}
        </motion.div>
      </motion.div>

      <motion.div
        className={style.chrome}
        initial={{ opacity: 0 }}
        animate={{ opacity: zoomed ? 0 : 1 }}
        exit={{ opacity: 0 }}
        transition={fadeTransition}
        // 不放大時故意不設 inline pointerEvents，讓 CSS 的
        // pointer-events:none（自己）+ >* auto（按鈕）生效，空白處才能穿透到圖片。
        style={zoomed ? { pointerEvents: 'none' } : undefined}
      >
        <button
          ref={closeButtonRef}
          type="button"
          className={style.closeButton}
          onClick={requestClose}
          aria-label={t('close')}
        >
          <Icon name="xmark" />
        </button>

        {total > 1 && (
          <div className={style.counter} aria-live="polite">
            {t('counter', { current: index + 1, total })}
          </div>
        )}

        {total > 1 && (
          <>
            <button
              type="button"
              className={`${style.arrow} ${style.arrowPrev}`}
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              aria-label={t('previous')}
            >
              <Icon name="arrow-left" />
            </button>
            <button
              type="button"
              className={`${style.arrow} ${style.arrowNext}`}
              onClick={() => goTo(index + 1)}
              disabled={index === total - 1}
              aria-label={t('next')}
            >
              <Icon name="arrow-right" />
            </button>
          </>
        )}

        <div className={style.bottomBar}>
          {caption && <p className={style.caption}>{caption}</p>}

          {total > 1 && (
            <div
              className={style.thumbStrip}
              role="tablist"
              aria-label={t('thumbnails')}
            >
              {images.map((img, i) => (
                <button
                  key={img.url}
                  ref={(el) => {
                    thumbRefs.current[i] = el
                  }}
                  type="button"
                  className={`${style.thumb} ${i === index ? style.thumbActive : ''}`}
                  onClick={() => goTo(i)}
                  aria-label={t('goTo', { n: i + 1 })}
                  aria-current={i === index}
                >
                  <Image src={img.url} alt="" fill sizes="64px" className={style.thumbImg} />
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </>,
    document.body
  )
}
