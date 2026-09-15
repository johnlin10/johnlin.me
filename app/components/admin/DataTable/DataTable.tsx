'use client'

import { useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import Button from '../Button/Button'
import Popover from '../Popover/Popover'
import Icon from '@/app/components/Icon/Icon'
import style from './DataTable.module.scss'

const DEFAULT_TRUNCATE_WIDTH = '20rem'
// 點到這些元素交給元素自己處理，不算點整列
const INTERACTIVE = 'a, button, input, select, textarea, label'

/**
 * 欄位定義。
 *
 * 預設不換行（適合 slug、狀態、標籤這類短字串，避免擠成三四個字一行）；
 * 需要換行的長文字欄位（如描述）設 `wrap`，並搭配 `maxWidth` 限制寬度；
 * 網址這類不該換行的長字串設 `truncate`，單行顯示、超過 `maxWidth` 用省略號截斷，
 * 完整內容請在 render 裡用 title 補上。
 */
export interface DataTableColumn<T> {
  key: string
  header: ReactNode
  render?: (row: T) => ReactNode
  wrap?: boolean
  /** 單行截斷，寬度上限取 maxWidth，沒給就是 20rem。 */
  truncate?: boolean
  minWidth?: string
  maxWidth?: string
  className?: string
}

/**
 * 「修改內容」協定：由引入端宣告每列要出現哪些操作按鈕（編輯／刪除…），
 * 表格只負責依協定渲染，不內建任何特定業務邏輯。
 */
export interface DataTableAction<T> {
  label: ReactNode
  onClick: (row: T) => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  disabled?: (row: T) => boolean
  hidden?: (row: T) => boolean
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  rowKey: (row: T) => string
  actions?: DataTableAction<T>[]
  /** 操作欄標題；選單模式下當「⋯」按鈕的無障礙名稱。 */
  actionsHeader?: ReactNode
  /** 操作攤成按鈕（預設），或收進每列最右邊的「⋯」選單。 */
  actionsAs?: 'buttons' | 'menu'
  /** 點整列時呼叫，列有焦點時按 Enter 也會觸發；點到列裡的按鈕、連結不算。 */
  onRowClick?: (row: T) => void
  className?: string
}

/**
 * 通用後台表格組件，統一 /admin 各頁列表的結構與樣式。
 */
export default function DataTable<T>({
  columns,
  data,
  rowKey,
  actions,
  actionsHeader,
  actionsAs = 'buttons',
  onRowClick,
  className = '',
}: DataTableProps<T>) {
  const hasActions = !!actions && actions.length > 0
  const [menuRow, setMenuRow] = useState<T | null>(null)
  const menuAnchorRef = useRef<HTMLElement | null>(null)

  const visibleActions = (row: T) => actions!.filter((action) => !action.hidden?.(row))

  const handleRowClick = (event: MouseEvent, row: T) => {
    if ((event.target as Element).closest(INTERACTIVE)) return
    if (window.getSelection()?.toString()) return
    onRowClick?.(row)
  }

  const handleRowKeyDown = (event: KeyboardEvent, row: T) => {
    if (event.key === 'Enter' && event.target === event.currentTarget) onRowClick?.(row)
  }

  const openMenu = (anchor: HTMLElement, row: T) => {
    menuAnchorRef.current = anchor
    setMenuRow((current) => (current === row ? null : row))
  }

  return (
    <div className={[style.table_wrapper, className].filter(Boolean).join(' ')}>
      <table className={style.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                style={column.minWidth ? { minWidth: column.minWidth } : undefined}
              >
                {column.header}
              </th>
            ))}
            {hasActions &&
              (actionsAs === 'menu' ? (
                <th className={style.menu_head} />
              ) : (
                <th>{actionsHeader}</th>
              ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={rowKey(row)}
              className={onRowClick ? style.clickable : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? (event) => handleRowClick(event, row) : undefined}
              onKeyDown={onRowClick ? (event) => handleRowKeyDown(event, row) : undefined}
            >
              {columns.map((column) => {
                const content = column.render
                  ? column.render(row)
                  : String((row as Record<string, unknown>)[column.key] ?? '')
                return (
                  <td
                    key={column.key}
                    className={[
                      column.wrap ? style.cell_wrap : style.cell_nowrap,
                      column.className,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={
                      column.wrap && column.maxWidth
                        ? { maxWidth: column.maxWidth }
                        : undefined
                    }
                  >
                    {/* max-width 直接設在 td 上有些瀏覽器不理，包一層才截得住 */}
                    {column.truncate ? (
                      <div
                        className={style.cell_truncate}
                        style={{ maxWidth: column.maxWidth ?? DEFAULT_TRUNCATE_WIDTH }}
                      >
                        {content}
                      </div>
                    ) : (
                      content
                    )}
                  </td>
                )
              })}
              {hasActions &&
                (actionsAs === 'menu' ? (
                  <td className={style.menu_cell}>
                    <button
                      type="button"
                      className={style.menu_trigger}
                      aria-label={typeof actionsHeader === 'string' ? actionsHeader : undefined}
                      aria-haspopup="menu"
                      aria-expanded={menuRow === row}
                      onClick={(event) => openMenu(event.currentTarget, row)}
                    >
                      <Icon name="ellipsis" />
                    </button>
                  </td>
                ) : (
                  <td>
                    <div className={style.actions}>
                      {visibleActions(row).map((action, index) => (
                        <Button
                          key={index}
                          variant={action.variant ?? 'secondary'}
                          size="small"
                          onClick={() => action.onClick(row)}
                          disabled={action.disabled?.(row)}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  </td>
                ))}
            </tr>
          ))}
        </tbody>
      </table>

      {hasActions && actionsAs === 'menu' && (
        <Popover
          isOpen={menuRow !== null}
          onClose={() => setMenuRow(null)}
          anchorRef={menuAnchorRef}
          placement="bottom"
          width={160}
          className={style.menu_popover}
        >
          {menuRow !== null && (
            <ul className={style.menu} role="menu">
              {visibleActions(menuRow).map((action, index) => (
                <li key={index} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className={`${style.menu_item} ${action.variant === 'danger' ? style.menu_danger : ''}`}
                    disabled={action.disabled?.(menuRow)}
                    onClick={() => {
                      setMenuRow(null)
                      action.onClick(menuRow)
                    }}
                  >
                    {action.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Popover>
      )}
    </div>
  )
}
