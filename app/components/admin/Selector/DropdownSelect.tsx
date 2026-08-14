'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import Popover from '@/app/components/admin/Popover/Popover'
import Icon, { type IconName } from '@/app/components/Icon/Icon'
import style from './Selector.module.scss'

export interface DropdownOption {
  value: string
  label: string
}

interface DropdownSelectProps {
  value: string
  onChange: (value: string) => void
  options: DropdownOption[]
  /** 對應「未選擇」那一項的顯示文字，選中值為空字串時也用這行當觸發按鈕的文字。 */
  placeholder: string
  compact?: boolean
  /** 是否在清單裡附一個「清空」選項（value=''）。像語言這種一定要選一個
   *  的欄位設 false，避免使用者選到一個無效的空狀態。預設 true，維持
   *  CategorySelector／SeriesSelector 原本「可以不選」的行為。 */
  clearable?: boolean
  /** 觸發按鈕文字前的圖示，純裝飾用（例如語言切換的地球圖示）。 */
  icon?: IconName
  /** 觸發按鈕上要顯示的文字，預設用選中選項的 label。像語言切換這種選項
   *  清單裡放完整名稱、但按鈕本體只想露出縮寫時可以覆寫。 */
  triggerLabel?: string
  disabled?: boolean
}

// 選項面板至少要有這麼寬，不然像語言切換那種觸發鈕本體很窄（只放縮寫）
// 時，面板會被硬壓到跟觸發鈕一樣窄，選項清單裡的完整名稱擠到被迫換行。
const MIN_PANEL_WIDTH = 200

/**
 * 取代原生 <select> 的自訂下拉：原生 select 的選項面板是瀏覽器/系統原生
 * 樣式，CSS 完全管不到，跟站上暖色文青風格接不起來。這裡改成一顆觸發按鈕
 * ＋ Popover 裝的選項清單，樣式（含選中狀態、hover、圓角）全部自己畫。
 */
export default function DropdownSelect({
  value,
  onChange,
  options,
  placeholder,
  compact = false,
  clearable = true,
  icon,
  triggerLabel,
  disabled = false,
}: DropdownSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [panelWidth, setPanelWidth] = useState(240)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  useLayoutEffect(() => {
    if (isOpen && triggerRef.current) {
      setPanelWidth(
        Math.max(triggerRef.current.getBoundingClientRect().width, MIN_PANEL_WIDTH)
      )
    }
  }, [isOpen])

  const selected = options.find((option) => option.value === value)

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`${style.select} ${compact ? style.compact : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {icon && (
          <Icon name={icon} size="xs" className={style.select_leading_icon} />
        )}
        <span
          className={`${style.select_label} ${!selected ? style.placeholder : ''}`}
        >
          {triggerLabel ?? (selected ? selected.label : placeholder)}
        </span>
        <Icon
          name="chevron-down"
          size="xs"
          className={`${style.select_icon} ${isOpen ? style.select_icon_open : ''}`}
        />
      </button>

      <Popover
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        anchorRef={triggerRef}
        placement="bottom"
        width={panelWidth}
        className={style.select_popover}
      >
        <ul className={style.option_list} role="listbox">
          {clearable && (
            <li role="option" aria-selected={value === ''}>
              <button
                type="button"
                className={`${style.option} ${value === '' ? style.option_active : ''}`}
                onClick={() => {
                  onChange('')
                  setIsOpen(false)
                }}
              >
                {placeholder}
              </button>
            </li>
          )}
          {options.map((option) => (
            <li key={option.value} role="option" aria-selected={option.value === value}>
              <button
                type="button"
                className={`${style.option} ${
                  option.value === value ? style.option_active : ''
                }`}
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      </Popover>
    </>
  )
}
