import { minutesOf } from '@/app/lib/tutoring'

// 一小時的高度（rem）；50 分鐘的一節課也放得下標題和時間兩行
export const HOUR_REM = 3.5

/**
 * 時間軸涵蓋的整點範圍：第一件行程的開始往前取整，最後一件的結束往後取整。
 * @param items 這一天的行程
 * @returns 起訖的小時
 */
export function hourRange(items: { start: string; end: string }[]) {
  return {
    first: Math.floor(Math.min(...items.map((item) => minutesOf(item.start))) / 60),
    last: Math.ceil(Math.max(...items.map((item) => minutesOf(item.end))) / 60),
  }
}
