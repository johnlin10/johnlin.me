'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import Icon from '@/app/components/Icon/Icon'
import style from './PhotoEditLayout.module.scss'

export interface FilmstripItem {
  id: string
  src: string
  /** 給螢幕閱讀器的名稱，例如「第 3 張，共 12 張」。 */
  label: string
  /** done：已完成（打勾）；warn：有問題要回頭看（標黃）。 */
  mark?: 'done' | 'warn'
}

interface FilmstripProps {
  items: FilmstripItem[]
  currentId: string
  onSelect: (id: string) => void
  /** 接在最後一格之後，例如上傳頁的「加入照片」。 */
  children?: ReactNode
}

/** 底部的縮圖列：跳到任一張，目前這張會自動捲進畫面中間。 */
export default function Filmstrip({ items, currentId, onSelect, children }: FilmstripProps) {
  const refs = useRef(new Map<string, HTMLButtonElement>())

  useEffect(() => {
    refs.current.get(currentId)?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [currentId])

  return (
    <div className={style.filmstrip}>
      {items.map((item) => (
        <button
          key={item.id}
          ref={(el) => {
            if (el) refs.current.set(item.id, el)
            else refs.current.delete(item.id)
          }}
          type="button"
          className={`${style.filmThumb} ${item.id === currentId ? style.filmCurrent : ''}`}
          onClick={() => onSelect(item.id)}
          aria-label={item.label}
          aria-current={item.id === currentId ? 'step' : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.src} alt="" loading="lazy" decoding="async" />
          {item.mark === 'done' && (
            <span className={`${style.filmMark} ${style.filmMarkDone}`}>
              <Icon name="check" size="xs" />
            </span>
          )}
          {item.mark === 'warn' && (
            <span className={`${style.filmMark} ${style.filmMarkWarn}`}>
              <Icon name="triangle-exclamation" size="xs" />
            </span>
          )}
        </button>
      ))}
      {children}
    </div>
  )
}
