'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import Button from '@/app/components/admin/Button/Button'
import {
  useAiAssist,
  type AiTask,
} from '@/app/components/admin/PostEditor/useAiAssist'
import style from './AiSuggestion.module.scss'

interface AiSuggestionProps {
  /** 只顯示屬於這個任務的建議——同一時間全域只會有一筆 suggestion。 */
  task: AiTask
}

/**
 * 貼在欄位正下方的就地建議卡，不是全螢幕彈窗。
 * 外層呼叫端要包一層 `position: relative` 的容器。
 */
export default function AiSuggestion({ task }: AiSuggestionProps) {
  const t = useTranslations('AdminPage.aiSuggestion')
  const { suggestion, accept, dismiss } = useAiAssist()
  const cardRef = useRef<HTMLDivElement>(null)

  const visible = suggestion?.task === task

  useEffect(() => {
    if (!visible) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    const onPointerDown = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        dismiss()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [visible, dismiss])

  if (!visible || !suggestion) return null

  return (
    <div ref={cardRef} className={style.card}>
      <p className={style.label}>{t('label')}</p>

      {Array.isArray(suggestion.value) ? (
        <div className={style.pills}>
          {suggestion.value.map((word) => (
            <span key={word} className={style.pill}>
              {word}
            </span>
          ))}
        </div>
      ) : (
        <p className={style.value}>{suggestion.value}</p>
      )}

      <div className={style.actions}>
        <Button variant="secondary" size="small" onClick={dismiss}>
          {t('cancel')}
        </Button>
        <Button variant="primary" size="small" onClick={accept}>
          {t('apply')}
        </Button>
      </div>
    </div>
  )
}
