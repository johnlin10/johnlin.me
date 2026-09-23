'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { Link } from '@/i18n/navigation'
import { createPublicClient } from '@/app/lib/supabase/public'
import { getKbSharedNote, type KbSharedNote } from '@/app/lib/supabase/kb'
import { splitNote } from '@/app/lib/kb'
import postStyle from '@/app/components/blog/PostContent/PostContent.module.scss'
import style from './kb-share.module.scss'

// Markdown 和數學式很大，第一次懸停才載入，不拖慢分享頁本身
const KbMarkdown = dynamic(() => import('./KbMarkdown'))

// 停多久才跳出預覽，滑鼠只是經過就不跳
const OPEN_DELAY = 350
// 離開連結後多久收起，留時間把滑鼠移進預覽
const CLOSE_DELAY = 200
const WIDTH = 416
const MAX_HEIGHT = 384
const GUTTER = 16
const GAP = 8

// 同一頁重複懸停不再打資料庫
const loaded = new Map<string, Promise<KbSharedNote | null>>()

/**
 * 讀一篇筆記，同一篇只讀一次。
 * @param token 分享 token
 * @param code 筆記代碼
 * @returns 看不到或讀不到回 null
 */
function load(token: string, code: string) {
  const key = `${token}/${code}`
  if (!loaded.has(key)) {
    loaded.set(key, getKbSharedNote(createPublicClient(), token, code).catch(() => null))
  }
  return loaded.get(key)!
}

/**
 * 預覽放在連結下方，下面空間不夠就放上方；左右不超出畫面。
 * @param anchor 連結
 * @returns fixed 定位
 */
function place(anchor: HTMLElement): CSSProperties {
  const rect = anchor.getBoundingClientRect()
  const width = Math.min(WIDTH, innerWidth - GUTTER * 2)
  const left = Math.min(Math.max(rect.left, GUTTER), innerWidth - width - GUTTER)
  const below = innerHeight - rect.bottom - GAP - GUTTER
  const above = rect.top - GAP - GUTTER
  return below >= Math.min(above, MAX_HEIGHT)
    ? { left, width, top: rect.bottom + GAP, maxHeight: Math.min(below, MAX_HEIGHT) }
    : { left, width, bottom: innerHeight - rect.top + GAP, maxHeight: Math.min(above, MAX_HEIGHT) }
}

/**
 * 內文裡的筆記連結。滑鼠停一下就在旁邊跳出那一篇的預覽；觸控沒有懸停，點了直接跳頁。
 * @param props.token 分享 token
 * @param props.code 連到的筆記代碼
 * @param props.href 連到的網址
 */
export default function KbPreviewLink({
  token,
  code,
  href,
  children,
}: {
  token: string
  code: string
  href: string
  children: ReactNode
}) {
  const anchor = useRef<HTMLSpanElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const timer = useRef<number>(undefined)
  // 每次離開加一，讀完回來時對不上就不打開
  const hover = useRef(0)
  const [open, setOpen] = useState<{ note: KbSharedNote; position: CSSProperties } | null>(null)

  const enter = (event: React.PointerEvent) => {
    if (event.pointerType !== 'mouse') return
    clearTimeout(timer.current)
    if (open) return
    const id = ++hover.current
    const note = load(token, code)
    timer.current = window.setTimeout(async () => {
      const result = await note
      if (result && hover.current === id && anchor.current) {
        setOpen({ note: result, position: place(anchor.current) })
      }
    }, OPEN_DELAY)
  }

  const leave = () => {
    hover.current++
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(null), CLOSE_DELAY)
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  // 預覽是 fixed，頁面一捲就對不上連結，直接收起；預覽自己裡面捲動不算
  useEffect(() => {
    if (!open) return
    const close = (event: Event) => {
      if (!panel.current?.contains(event.target as Node)) setOpen(null)
    }
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(null)
    addEventListener('scroll', close, { capture: true, passive: true })
    addEventListener('keydown', escape)
    return () => {
      removeEventListener('scroll', close, { capture: true })
      removeEventListener('keydown', escape)
    }
  }, [open])

  const note = open && splitNote(open.note.path, open.note.content)

  return (
    <span ref={anchor} onPointerEnter={enter} onPointerLeave={leave}>
      <Link href={href}>{children}</Link>
      {open &&
        note &&
        createPortal(
          <div
            ref={panel}
            className={style.preview}
            style={open.position}
            onPointerEnter={() => clearTimeout(timer.current)}
            onPointerLeave={leave}
          >
            <p className={style.previewTitle}>{note.title}</p>
            <div className={`${postStyle.post_content} ${style.content} ${style.previewBody}`}>
              {/* ponytail: 預覽裡的連結只能點、不再跳預覽，要一層層看下去再加 */}
              <KbMarkdown
                token={token}
                body={note.body}
                links={open.note.links}
                renderLink={(to, text) => <Link href={to}>{text}</Link>}
              />
            </div>
          </div>,
          document.body,
        )}
    </span>
  )
}
