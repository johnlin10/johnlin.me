'use client'

import { useEffect } from 'react'
import style from './Modal.module.scss'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'small' | 'medium' | 'large'
}

/**
 * 通用彈窗組件
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'medium',
}: ModalProps) {
  //* 按 ESC 關閉彈窗
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className={style.modal_overlay} onClick={onClose}>
      <div
        className={`${style.modal_content} ${style[size]}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={style.modal_header}>
          <h2 className={style.modal_title}>{title}</h2>
          <button className={style.close_button} onClick={onClose}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className={style.modal_body}>{children}</div>
      </div>
    </div>
  )
}

