'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useTranslations } from 'next-intl'
import { useToast } from '@/app/components/admin/Toast/ToastProvider'

export type AiTask = 'slug' | 'description' | 'coverAlt' | 'keywords'
export type AiValue<T extends AiTask> = T extends 'keywords' ? string[] : string

interface Suggestion<T extends AiTask = AiTask> {
  task: T
  value: AiValue<T>
  apply: (value: AiValue<T>) => void
}

interface RequestOptions<T extends AiTask> {
  /** 目前欄位內容：空的話直接套用，不出現建議卡。 */
  current: string | string[]
  apply: (value: AiValue<T>) => void
}

interface AiAssistContextValue {
  pending: AiTask | null
  suggestion: Suggestion | null
  request: <T extends AiTask>(
    task: T,
    payload: Record<string, unknown>,
    options: RequestOptions<T>
  ) => Promise<void>
  accept: () => void
  dismiss: () => void
}

const AiAssistContext = createContext<AiAssistContextValue | null>(null)

function isEmptyValue(value: string | string[]): boolean {
  return Array.isArray(value) ? value.length === 0 : value.trim() === ''
}

/**
 * 全域只維護一組 pending/suggestion 狀態，掛在 PostEditorProvider 裡。
 * 換一顆 AI 按鈕會取代前一張建議卡，畫面上不會同時出現兩張。
 */
export function AiAssistProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('AdminPage.postEditor.aiAssist')
  const toast = useToast()
  const [pending, setPending] = useState<AiTask | null>(null)
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)

  const request = useCallback(
    async <T extends AiTask>(
      task: T,
      payload: Record<string, unknown>,
      options: RequestOptions<T>
    ) => {
      setPending(task)
      setSuggestion(null)
      try {
        const res = await fetch('/api/admin/ai', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ task, payload }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error(data.error ?? t('genericError'))
          return
        }
        const value = data.result as AiValue<T>
        if (isEmptyValue(options.current)) {
          options.apply(value)
        } else {
          setSuggestion({ task, value, apply: options.apply } as Suggestion)
        }
      } catch {
        toast.error(t('genericError'))
      } finally {
        setPending(null)
      }
    },
    [toast, t]
  )

  const accept = useCallback(() => {
    if (!suggestion) return
    suggestion.apply(suggestion.value)
    setSuggestion(null)
  }, [suggestion])

  const dismiss = useCallback(() => setSuggestion(null), [])

  const value = useMemo(
    () => ({ pending, suggestion, request, accept, dismiss }),
    [pending, suggestion, request, accept, dismiss]
  )

  return (
    <AiAssistContext.Provider value={value}>
      {children}
    </AiAssistContext.Provider>
  )
}

export function useAiAssist() {
  const ctx = useContext(AiAssistContext)
  if (!ctx) throw new Error('useAiAssist 必須在 AiAssistProvider 內使用')
  return ctx
}
