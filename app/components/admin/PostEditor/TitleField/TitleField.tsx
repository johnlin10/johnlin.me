'use client'

import { useLayoutEffect, useRef } from 'react'
import style from './TitleField.module.scss'

interface TitleFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  size?: 'title' | 'subtitle'
  onEnter?: () => void
  autoFocus?: boolean
}

/**
 * 自動長高的無邊框標題輸入框。標題和副標共用，用 size 切字級。
 */
export default function TitleField({
  value,
  onChange,
  placeholder,
  size = 'title',
  onEnter,
  autoFocus = false,
}: TitleFieldProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className={`${style.field} ${style[size]}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          onEnter?.()
        }
      }}
    />
  )
}
