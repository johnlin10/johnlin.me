'use client'

import Icon from '@/app/components/Icon/Icon'
import style from './AiButton.module.scss'

interface AiButtonProps {
  label: string
  onClick: () => void
  pending?: boolean
  disabled?: boolean
}

/** 小尺寸 icon 按鈕，掛在欄位 label 旁邊，用來觸發 AI 輔助生成。 */
export default function AiButton({
  label,
  onClick,
  pending = false,
  disabled = false,
}: AiButtonProps) {
  return (
    <button
      type="button"
      className={style.button}
      onClick={onClick}
      disabled={disabled || pending}
      title={label}
      aria-label={label}
    >
      <Icon
        name="wand-magic-sparkles"
        className={pending ? style.pending : undefined}
      />
    </button>
  )
}
