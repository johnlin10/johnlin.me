// 學校的節次表。A 是午休、B 是傍晚，排在前後兩節之間
export const PERIODS = [
  { code: '1', start: '08:20', end: '09:10' },
  { code: '2', start: '09:15', end: '10:05' },
  { code: '3', start: '10:15', end: '11:05' },
  { code: '4', start: '11:10', end: '12:00' },
  { code: 'A', start: '12:00', end: '13:10' },
  { code: '5', start: '13:10', end: '14:00' },
  { code: '6', start: '14:05', end: '14:55' },
  { code: '7', start: '15:05', end: '15:55' },
  { code: '8', start: '16:00', end: '16:50' },
  { code: 'B', start: '17:10', end: '18:00' },
  { code: '9', start: '18:20', end: '19:05' },
  { code: '10', start: '19:10', end: '20:00' },
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
