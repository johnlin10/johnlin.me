'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Photo } from '@/app/types/photo'

/**
 * 印象表的選取與鍵盤導覽。吃的是「已篩選、已排序」的扁平陣列 —— 用同一個
 * 陣列驅動渲染與導覽，J/K 跨年份分段移動才不用特別處理邊界。
 *
 * 目前只做單選＋導覽。多選（Space）與狀態快捷鍵（E）留到 Phase 6/7：
 * 那兩個是會寫資料的操作，「唯讀」這個階段先不做，避免鍵盤事件裡混進
 * 還沒有對應 UI 承接的動作。
 */
export function usePhotoSelection(photos: Photo[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // 篩選條件改變、或選到的那張被篩掉時，退回目前清單的第一張；
  // 清單清空就沒有選取。給鍵盤使用者一個永遠有效的落點（WAI-ARIA listbox
  // 要求隨時有一個成員可以拿到 tabIndex 0），也讓檢閱欄一開始就有東西可看。
  useEffect(() => {
    if (photos.length === 0) {
      setSelectedId(null)
      return
    }
    setSelectedId((current) =>
      current && photos.some((p) => p.id === current) ? current : photos[0].id
    )
  }, [photos])

  const select = useCallback((id: string | null) => {
    setSelectedId(id)
  }, [])

  const moveBy = useCallback(
    (delta: number) => {
      if (photos.length === 0) return
      const index = photos.findIndex((p) => p.id === selectedId)
      const next = Math.min(
        Math.max((index === -1 ? 0 : index) + delta, 0),
        photos.length - 1
      )
      setSelectedId(photos[next].id)
    },
    [photos, selectedId]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // 說明／地名這些欄位進來之前先擋一次：往後 Phase 6 的檢閱欄會有
      // 真正的輸入框，這個防呆現在就寫好，不必等踩到才補。
      const target = e.target as HTMLElement | null
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return
      }

      switch (e.key) {
        case 'j':
        case 'J':
        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault()
          moveBy(1)
          break
        case 'k':
        case 'K':
        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault()
          moveBy(-1)
          break
        case 'Home':
          e.preventDefault()
          if (photos.length > 0) setSelectedId(photos[0].id)
          break
        case 'End':
          e.preventDefault()
          if (photos.length > 0) setSelectedId(photos[photos.length - 1].id)
          break
      }
    },
    [photos, moveBy]
  )

  return { selectedId, select, moveBy, handleKeyDown }
}
