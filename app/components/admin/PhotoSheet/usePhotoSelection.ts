'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Photo } from '@/app/types/photo'

/**
 * 印象表的選取與鍵盤導覽。吃的是「已篩選、已排序」的扁平陣列 —— 用同一個
 * 陣列驅動渲染與導覽，J/K 跨年份分段移動才不用特別處理邊界。
 *
 * 兩種「選取」刻意分開：
 * - selectedId 是游標，永遠只有一個，決定檢閱欄顯示哪一張。
 * - checkedIds 是勾選，給批次操作用，可以是空集合。
 * 合成一個的話，「我只是想看下一張」跟「我要把這張加進待發布清單」就沒辦法
 * 用同一組方向鍵表達了。
 */
export function usePhotoSelection(photos: Photo[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

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

  // 勾選的照片被刪掉或被篩掉之後要跟著移除，否則批次操作會對著已經不存在的
  // id 送出請求，而且計數會跟畫面上看得到的勾數對不起來。
  useEffect(() => {
    setCheckedIds((prev) => {
      if (prev.size === 0) return prev
      const visible = new Set(photos.map((p) => p.id))
      const next = new Set([...prev].filter((id) => visible.has(id)))
      return next.size === prev.size ? prev : next
    })
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

  const toggleChecked = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearChecked = useCallback(() => {
    setCheckedIds(new Set())
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // 檢閱欄有真正的輸入框，在裡面打字時不能被當成導覽指令 ——
      // 沒有這一關的話，在說明欄輸入含 j／k 的字就會跳照片。
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
        case ' ':
          // 空白鍵在 button 上的原生行為是「按下」，會觸發 onClick 而變成選取，
          // 這裡要的是勾選，所以攔掉預設行為。
          e.preventDefault()
          if (selectedId) toggleChecked(selectedId)
          break
        case 'Escape':
          if (checkedIds.size > 0) {
            e.preventDefault()
            clearChecked()
          }
          break
      }
    },
    [photos, moveBy, selectedId, checkedIds, toggleChecked, clearChecked]
  )

  return {
    selectedId,
    select,
    moveBy,
    checkedIds,
    toggleChecked,
    clearChecked,
    handleKeyDown,
  }
}
