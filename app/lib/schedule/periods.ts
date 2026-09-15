// ponytail: 常見制度佔位，之後換成學校的節次表；代號不變的話舊資料不用動
export const PERIODS = [
  { code: '1', start: '08:10', end: '09:00' },
  { code: '2', start: '09:10', end: '10:00' },
  { code: '3', start: '10:10', end: '11:00' },
  { code: '4', start: '11:10', end: '12:00' },
  { code: 'N', start: '12:10', end: '13:00' },
  { code: '5', start: '13:10', end: '14:00' },
  { code: '6', start: '14:10', end: '15:00' },
  { code: '7', start: '15:10', end: '16:00' },
  { code: '8', start: '16:10', end: '17:00' },
  { code: '9', start: '17:10', end: '18:00' },
  { code: '10', start: '18:10', end: '19:00' },
] as const

export type SlotTime = { day: number; start: string; end: string }

/**
 * 節次在時間表裡的位置。
 * @param code 節次代號
 * @returns 索引；不在時間表裡回 -1
 */
export function periodIndex(code: string): number {
  return PERIODS.findIndex((period) => period.code === code)
}

/**
 * 兩個時段是否在同一天、節次有交集。
 * @param a 時段
 * @param b 時段
 * @returns 重疊回 true
 */
export function overlaps(a: SlotTime, b: SlotTime): boolean {
  return (
    a.day === b.day &&
    periodIndex(a.start) <= periodIndex(b.end) &&
    periodIndex(b.start) <= periodIndex(a.end)
  )
}
