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
}: InputProps) {
  return (
    <div
      className={`${style.input_wrapper} ${fullWidth ? style.full_width : ''}`}
    >
      {label && (
        <label className={style.label}>
          {label}
          {required && <span className={style.required}>*</span>}
        </label>
      )}

      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={`${style.input} ${error ? style.error : ''}`}
      />

      {error && <span className={style.error_text}>{error}</span>}
      {helper && !error && <span className={style.helper_text}>{helper}</span>}
    </div>
  )
}

