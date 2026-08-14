'use client'

import type { ReactNode } from 'react'
import Button from '../Button/Button'
import style from './DataTable.module.scss'

/**
 * 欄位定義。
 *
 * 預設不換行（適合 slug、狀態、標籤這類短字串，避免擠成三四個字一行）；
 * 需要換行的長文字欄位（如描述）設 `wrap`，並搭配 `maxWidth` 限制寬度。
 */
export interface DataTableColumn<T> {
  key: string
  header: ReactNode
  render?: (row: T) => ReactNode
  wrap?: boolean
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
  actionsHeader?: ReactNode
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
  className = '',
}: DataTableProps<T>) {
  const hasActions = !!actions && actions.length > 0

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
            {hasActions && <th>{actionsHeader}</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
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
                  {column.render
                    ? column.render(row)
                    : String((row as Record<string, unknown>)[column.key] ?? '')}
                </td>
              ))}
              {hasActions && (
                <td>
                  <div className={style.actions}>
                    {actions!
                      .filter((action) => !action.hidden?.(row))
                      .map((action, index) => (
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
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
