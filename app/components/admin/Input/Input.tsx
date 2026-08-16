'use client'

import style from './Input.module.scss'

interface InputProps {
  label?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'email' | 'password' | 'number' | 'url'
  required?: boolean
  disabled?: boolean
  error?: string
  helper?: string
  fullWidth?: boolean
  compact?: boolean
  /** label 列右側的附加元件（例如 AI 輔助按鈕）。 */
  action?: React.ReactNode
}

/**
 * 通用輸入框組件
 */
export default function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
  disabled = false,
  error,
  helper,
  fullWidth = true,
  compact = false,
  action,
}: InputProps) {
  return (
    <div
      className={`${style.input_wrapper} ${fullWidth ? style.full_width : ''}`}
    >
      {(label || action) && (
        <div className={style.label_row}>
          {label && (
            <label className={style.label}>
              {label}
              {required && <span className={style.required}>*</span>}
            </label>
          )}
          {action}
        </div>
      )}

      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={`${style.input} ${compact ? style.compact : ''} ${error ? style.error : ''}`}
      />

      {error && <span className={style.error_text}>{error}</span>}
      {helper && !error && <span className={style.helper_text}>{helper}</span>}
    </div>
  )
}

