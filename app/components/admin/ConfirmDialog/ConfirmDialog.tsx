'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import Modal from '@/app/components/admin/Modal/Modal'
import Button from '@/app/components/admin/Button/Button'
import style from './ConfirmDialog.module.scss'

interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/**
 * 站內確認框（取代 confirm）。以 promise 化 API 呈現，底層複用共用 Modal。
 */
export function ConfirmDialogProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const t = useTranslations('AdminPage.confirmDialog')
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolveRef = useRef<((value: boolean) => void) | undefined>(undefined)

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts)
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  const handle = (result: boolean) => {
    resolveRef.current?.(result)
    setOptions(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        isOpen={options !== null}
        onClose={() => handle(false)}
        title={options?.title ?? t('defaultTitle')}
        size="small"
      >
        {options && (
          <div className={style.body}>
            <p className={style.message}>{options.message}</p>
            <div className={style.actions}>
              <Button variant="secondary" onClick={() => handle(false)}>
                {options.cancelLabel ?? t('cancel')}
              </Button>
              <Button
                variant={options.danger ? 'danger' : 'primary'}
                onClick={() => handle(true)}
              >
                {options.confirmLabel ?? t('confirm')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm 必須在 ConfirmDialogProvider 內使用')
  return ctx
}
