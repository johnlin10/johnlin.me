'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { PhotoYearGroup } from '@/app/lib/photos/group'
import { computeJustifiedRows } from '@/app/lib/photos/justified'
import type { SupportedLocale } from '@/app/types/blog'
import SheetThumb from './SheetThumb'
import style from './PhotoSheet.module.scss'

interface ContactSheetProps {
  groups: PhotoYearGroup[]
  locale: SupportedLocale
  selectedId: string | null
  onSelect: (id: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
}

const ROW_HEIGHT = 120
const GAP = 8
const MIN_HEIGHT = 80

/**
 * 年份分段的齊行縮圖牆。齊行而不是方格網格是刻意的：不裁切照片才看得出
 * 構圖，這是編輯階段唯一需要的資訊。
 *
 * 每個年份各自一個 role="listbox"（WAI-ARIA 不允許 listbox 直接包標題），
 * 但整個印象表只有一個成員拿得到 tabIndex 0 —— 跨年份的移動由外層的
 * usePhotoSelection 統一處理，這裡只負責把 DOM 焦點跟著選取狀態走。
 */
export default function ContactSheet({
  groups,
  locale,
  selectedId,
  onSelect,
  onKeyDown,
}: ContactSheetProps) {
  const t = useTranslations('AdminPage.photos.sheet')
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)
  const thumbRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  useEffect(() => {
    const node = rootRef.current
    if (!node) return
    const measure = () => setWidth(node.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  // J/K 換選取時把瀏覽器焦點也帶過去，但只在焦點原本就在印象表裡才做——
  // 篩選條件變化、或初次載入預設選第一張時都不該把使用者的焦點搶走。
  useEffect(() => {
    if (!selectedId) return
    const root = rootRef.current
    if (!root || !root.contains(document.activeElement)) return
    thumbRefs.current.get(selectedId)?.focus()
  }, [selectedId])

  const rowsByYear = useMemo(
    () =>
      groups.map((group) => ({
        year: group.year,
        rows:
          width > 0
            ? computeJustifiedRows(group.photos, width, ROW_HEIGHT, GAP, MIN_HEIGHT)
            : [],
      })),
    [groups, width]
  )

  return (
    <div ref={rootRef} className={style.sheet} onKeyDown={onKeyDown}>
      {rowsByYear.map(({ year, rows }) => (
        <section key={year} className={style.yearGroup}>
          <h2 className={style.yearLabel}>{year}</h2>
          <div
            role="listbox"
            aria-label={t('yearLabel', { year })}
            className={style.rows}
          >
            {rows.map((row, i) => (
              <div key={i} className={style.row} style={{ gap: GAP }}>
                {row.items.map(({ photo, width: itemWidth }) => (
                  <SheetThumb
                    key={photo.id}
                    ref={(el) => {
                      if (el) thumbRefs.current.set(photo.id, el)
                      else thumbRefs.current.delete(photo.id)
                    }}
                    photo={photo}
                    locale={locale}
                    width={itemWidth}
                    height={row.height}
                    selected={photo.id === selectedId}
                    onSelect={() => onSelect(photo.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
