'use client'

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import style from './ExpandPopup.module.scss'

// 離視窗邊緣至少留這麼多
const GUTTER = 12
const EASING = 'cubic-bezier(0.2, 0, 0, 1)'

/**
 * 元素的位置和大小，給 Web Animations 當關鍵影格。
 * @param rect 位置和大小
 * @returns left/top/width/height 的 px 字串
 */
function frame(rect: { left: number; top: number; width: number; height: number }) {
  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  }
}

/**
 * 元素的內距，放大縮小時跟著過渡，內容才不會一開始就跳到新位置。
 * @param element 元素
 * @returns 四邊的 padding
 */
function padding(element: Element) {
  const { paddingTop, paddingRight, paddingBottom, paddingLeft } = getComputedStyle(element)
  return { paddingTop, paddingRight, paddingBottom, paddingLeft }
}

/**
 * ::before 的位置（例如色條），兩邊都有才跟著過渡。
 * @param element 元素
 * @returns top/bottom/left/width，沒有 ::before 回 null
 */
function before(element: Element) {
  const pseudo = getComputedStyle(element, '::before')
  if (pseudo.content === 'none') return null
  const { top, bottom, left, width } = pseudo
  return { top, bottom, left, width }
}

/**
 * 從某個元素原地放大成浮層，關掉時縮回去，看起來是同一塊東西變大。
 * 浮層從元素的左上角往外長，夾在視窗裡，至少 minWidth 寬，高度照內容。
 * 內距和 ::before 的位置也從元素的數值過渡到浮層的，兩邊樣式不同也接得起來。
 * 點外面、按 Esc、頁面捲動都會呼叫 onClose；開關由呼叫端決定。
 * @param props.open 打開與否
 * @param props.anchor 從哪個元素長出來；關掉時也縮回它
 * @param props.onClose 想關掉的時候呼叫
 * @param props.minWidth 放大後至少多寬（px），元素本身更寬就照元素
 * @param props.label 無障礙名稱
 * @param props.className 浮層的 class，通常跟元素同一套樣式才接得起來
 * @param props.style 浮層的 inline style，例如元素用的顏色變數
 * @param props.onClick 點浮層
 * @param props.onPointerLeave 滑鼠離開浮層，給滑過就放大的用法收起來
 */
export default function ExpandPopup({
  open,
  anchor,
  onClose,
  minWidth = 240,
  label,
  className = '',
  style: inline,
  onClick,
  onPointerLeave,
  children,
}: {
  open: boolean
  anchor: HTMLElement | null
  onClose: () => void
  minWidth?: number
  label?: string
  className?: string
  style?: CSSProperties
  onClick?: () => void
  onPointerLeave?: (event: React.PointerEvent) => void
  children: React.ReactNode
}) {
  const node = useRef<HTMLDivElement>(null)
  // 關掉之後還要留著跑縮回去的動畫，動畫完才真的拿掉
  const [visible, setVisible] = useState(false)
  if (open && !visible) setVisible(true)

  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

  // 打開或換了元素：先照最終寬度量出高度，再從元素的位置長過去
  useLayoutEffect(() => {
    const popup = node.current
    if (!open || !popup || !anchor?.isConnected) return
    const from = anchor.getBoundingClientRect()
    const width = Math.min(Math.max(from.width, minWidth), innerWidth - GUTTER * 2)
    popup.style.width = `${width}px`
    popup.style.height = 'auto'
    const height = Math.min(Math.max(popup.offsetHeight, from.height), innerHeight - GUTTER * 2)
    const to = {
      left: Math.min(Math.max(from.left, GUTTER), innerWidth - width - GUTTER),
      top: Math.min(Math.max(from.top, GUTTER), innerHeight - height - GUTTER),
      width,
      height,
    }
    Object.assign(popup.style, frame(to))
    if (reduced()) return
    const options = { duration: 220, easing: EASING }
    popup.animate(
      [
        { ...frame(from), ...padding(anchor) },
        { ...frame(to), ...padding(popup) },
      ],
      options,
    )
    const [barFrom, barTo] = [before(anchor), before(popup)]
    if (barFrom && barTo) popup.animate([barFrom, barTo], { ...options, pseudoElement: '::before' })
  }, [open, anchor, minWidth])

  // 關掉：縮回元素現在的位置，跑完才卸載；中途又打開就取消
  useEffect(() => {
    const popup = node.current
    if (open || !visible || !popup) return
    // 元素已經不在畫面上（換週了）就不縮，直接收
    const connected = anchor?.isConnected ?? false
    const options = {
      duration: connected && !reduced() ? 160 : 0,
      easing: EASING,
      fill: 'forwards' as const,
    }
    const animation = popup.animate(
      connected ? { ...frame(anchor!.getBoundingClientRect()), ...padding(anchor!) } : {},
      options,
    )
    const bar = connected && before(popup) ? before(anchor!) : null
    const barAnimation = bar ? popup.animate(bar, { ...options, pseudoElement: '::before' }) : null
    animation.finished.then(
      () => setVisible(false),
      () => {},
    )
    return () => {
      animation.cancel()
      barAnimation?.cancel()
    }
  }, [open, visible, anchor])

  // 點外面、Esc、捲動就關。點元素本身交給呼叫端（通常是切換）
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!node.current?.contains(target) && !anchor?.contains(target)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    // 浮層是 fixed，頁面一捲就跟元素錯開了
    const onScroll = (event: Event) => {
      if (!node.current?.contains(event.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, anchor, onClose])

  if (!visible || !anchor) return null

  return createPortal(
    <div
      ref={node}
      role="dialog"
      aria-label={label}
      className={`${className} ${style.popup} ${onClick ? style.clickable : ''}`}
      // 位置和層級寫在這裡，蓋過 className 帶來的 absolute
      style={{ ...inline, position: 'fixed', zIndex: 'var(--z-drawer)', margin: 0 }}
      onClick={onClick}
      onPointerLeave={onPointerLeave}
    >
      {children}
    </div>,
    document.body,
  )
}
