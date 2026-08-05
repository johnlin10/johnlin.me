'use client'

import { useEffect } from 'react'

/** 同一篇文章的瀏覽間隔冷卻時間（毫秒），預設 30 分鐘 */
const VIEW_COOLDOWN_MS = 30 * 60 * 1000

const STORAGE_KEY = 'blog_post_views'

interface ViewRecord {
  [postId: string]: number // timestamp of last counted view
}

function getViewRecords(): ViewRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function setViewRecord(postId: string) {
  try {
    const records = getViewRecords()
    records[postId] = Date.now()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // localStorage 不可用時靜默失敗
  }
}

/**
 * ViewTracker — 掛載時檢查 localStorage 的冷卻紀錄，
 * 若超過 cooldown 時間才向 /api/views 發送瀏覽計數請求。
 */
export default function ViewTracker({ postId }: { postId: string }) {
  useEffect(() => {
    const records = getViewRecords()
    const lastViewed = records[postId]
    const now = Date.now()

    // 在 cooldown 時間內 → 不計數
    if (lastViewed && now - lastViewed < VIEW_COOLDOWN_MS) return

    // 計數 +1
    setViewRecord(postId)
    fetch('/api/views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId }),
    }).catch(() => {
      // 靜默失敗，不影響使用者體驗
    })
  }, [postId])

  return null
}
