import type { NoteImage } from '@/app/types/note'

//* 短文圖片的寬高比計算。單一事實來源，前台版面／燈箱／後台預覽共用。

/** 舊資料沒有 w/h 時的版面 fallback（近似手機照片橫拍比例）。 */
export const NOTE_RATIO_FALLBACK = 3 / 2

/** 版面上最直只到 2:3，比這更直的圖片會被置中裁切，避免卡片被拉得過長。 */
export const NOTE_MIN_RATIO = 2 / 3

/**
 * 版面用：已 clamp 在 [2/3, +∞)。回傳 null 代表沒有可用尺寸，
 * 呼叫端應該省略 --note-ratio，交給 CSS 的 3:2 fallback 處理。
 */
export function noteLayoutRatio(img: NoteImage): number | null {
  const ratio = rawRatio(img)
  if (ratio === null) return null
  return Math.max(ratio, NOTE_MIN_RATIO)
}

/**
 * 燈箱用：不 clamp，全螢幕要看到完整、未裁切的原始比例。
 */
export function noteNaturalRatio(img: NoteImage): number | null {
  return rawRatio(img)
}

function rawRatio(img: NoteImage): number | null {
  const { w, h } = img
  if (!w || !h) return null
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null
  if (w <= 0 || h <= 0) return null
  return w / h
}
