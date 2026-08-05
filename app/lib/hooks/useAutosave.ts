'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

interface UseAutosaveOptions<TPatch extends object> {
  save: (patch: TPatch) => Promise<void>
  delay?: number
  maxWait?: number
  enabled?: boolean
}

interface UseAutosaveResult<TPatch extends object> {
  schedule: (patch: TPatch) => void
  flush: () => Promise<void>
  retry: () => void
  markClean: () => void
  state: SaveState
  lastSavedAt: Date | null
  error: unknown
}

/**
 * 命令式的自動儲存排程器（不是 useEffect 監聽資料）。
 * 監聽資料的 effect 會在 mount 時就觸發一次，等於「使用者還沒打字就先存了一次」。
 * 這裡改成只有 schedule() 被明確呼叫才會啟動計時器，儲存只可能由 mutator 發起。
 */
export function useAutosave<TPatch extends object>({
  save,
  delay = 1200,
  maxWait = 8000,
  enabled = true,
}: UseAutosaveOptions<TPatch>): UseAutosaveResult<TPatch> {
  const [state, setState] = useState<SaveState>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<unknown>(null)

  const pendingRef = useRef<TPatch | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deadlineRef = useRef<number | null>(null)
  const inFlightRef = useRef(false)
  const seqRef = useRef(0)
  const saveRef = useRef(save)
  saveRef.current = save
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const runSave = useCallback(async () => {
    if (pendingRef.current === null) return
    if (inFlightRef.current) return

    const patch = pendingRef.current
    pendingRef.current = null
    deadlineRef.current = null
    inFlightRef.current = true
    const seq = ++seqRef.current
    setState('saving')

    try {
      await saveRef.current(patch)
      if (seq === seqRef.current) {
        setState('saved')
        setLastSavedAt(new Date())
        setError(null)
      }
    } catch (err) {
      if (seq === seqRef.current) {
        setState('error')
        setError(err)
      }
      // 失敗的 patch 放回去，讓下一次 schedule/flush/retry 能重送。
      // 不在這裡自動重跑——持續性錯誤（例如 slug 衝突）會變成無限重試風暴，
      // 交由使用者按「重試」或下一次 schedule() 自然排程。
      pendingRef.current = pendingRef.current
        ? Object.assign({}, patch, pendingRef.current)
        : patch
    } finally {
      inFlightRef.current = false
    }
  }, [])

  const schedule = useCallback(
    (patch: TPatch) => {
      pendingRef.current = pendingRef.current
        ? Object.assign({}, pendingRef.current, patch)
        : patch

      if (!enabledRef.current) {
        setState('dirty')
        return
      }

      const now = Date.now()
      if (deadlineRef.current === null) deadlineRef.current = now

      clearTimer()

      if (now - deadlineRef.current >= maxWait) {
        void runSave()
        return
      }

      setState('dirty')
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        void runSave()
      }, delay)
    },
    [delay, maxWait, runSave]
  )

  const flush = useCallback(async () => {
    clearTimer()
    // 等待任何進行中的儲存結束，再送出待處理的 patch
    while (inFlightRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 30))
    }
    // enabled=false（例如編輯已發布文章）時 flush() 不該偷偷幫忙存——
    // 這個 hook 被步驟切換／離開時大量呼叫，若在這裡忽略 enabled，
    // 手動儲存模式就形同虛設，使用者沒按「更新」內容也會被寫進資料庫。
    if (!enabledRef.current) return
    await runSave()
  }, [runSave])

  const retry = useCallback(() => {
    void runSave()
  }, [runSave])

  // 提供給呼叫端在自己直接呼叫過寫入（例如「更新」按鈕繞過這個 hook 直接送出
  // 完整快照）之後，把待處理 patch 與 dirty 狀態清掉，避免之後誤判成仍有未儲存的變更。
  const markClean = useCallback(() => {
    clearTimer()
    pendingRef.current = null
    deadlineRef.current = null
    setState('saved')
    setLastSavedAt(new Date())
    setError(null)
  }, [])

  useEffect(() => clearTimer, [])

  // 分頁切到背景時盡量把待寫入的變更存掉——手機上比 beforeunload 可靠得多
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [flush])

  // Provider unmount（切換文章、離開編輯器）時射後不理地把變更沖掉
  useEffect(() => {
    return () => {
      void flush()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 有未儲存/儲存中/儲存失敗的變更時才掛 beforeunload，避免每次關頁都跳確認
  useEffect(() => {
    const needsGuard = state === 'dirty' || state === 'saving' || state === 'error'
    if (!needsGuard) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [state])

  return { schedule, flush, retry, markClean, state, lastSavedAt, error }
}
