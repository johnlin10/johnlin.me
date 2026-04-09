'use client'

import style from './Textarea.module.scss'

interface TextareaProps {
  label?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  error?: string
  helper?: string
  rows?: number
  fullWidth?: boolean
}

/**
 * 通用文字區域組件
 */
export default function Textarea({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  error,
  helper,
  rows = 4,
  fullWidth = true,
}: TextareaProps) {
  return (
    <div
      className={`${style.textarea_wrapper} ${
        fullWidth ? style.full_width : ''
      }`}
    >
      {label && (
        <label className={style.label}>
          {label}
          {required && <span className={style.required}>*</span>}
        </label>
      )}

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        rows={rows}
        className={`${style.textarea} ${error ? style.error : ''}`}
      />

      {error && <span className={style.error_text}>{error}</span>}
      {helper && !error && <span className={style.helper_text}>{helper}</span>}
    </div>
  )
}

