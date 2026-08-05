'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import Icon from '@/app/components/Icon/Icon'
import style from './Toast.module.scss'

type ToastType = 'success' | 'error'
interface ToastItem {
  id: number
  type: ToastType
  message: string
}

interface ToastContextValue {
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DURATION = 3200

/**
 * 站內 toast 提示（取代 alert）。掛在後台 layout 最外層，全後台頁面可用。
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = ++idRef.current
      setToasts((prev) => [...prev, { id, type, message }])
      setTimeout(() => remove(id), DURATION)
    },
    [remove]
  )

  const value: ToastContextValue = {
    success: (message) => push('success', message),
    error: (message) => push('error', message),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={style.viewport} aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`${style.toast} ${style[t.type]}`}>
            <Icon
              name={t.type === 'success' ? 'check' : 'triangle-exclamation'}
              size="sm"
            />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast 必須在 ToastProvider 內使用')
  return ctx
}
