// tools 總覽的算法：今天要做什麼、學期走到哪。日期都是台灣時間的 'YYYY-MM-DD' 字串

const DAY = 86_400_000

/**
 * 日期往後幾天。用 UTC 算，伺服器和瀏覽器的時區都不影響。
 * @param date 'YYYY-MM-DD'
 * @param days 天數，可以是負的
 * @returns 'YYYY-MM-DD'
 */
export function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10)
}

/**
 * 兩個日期差幾天。
 * @param from 'YYYY-MM-DD'
 * @param to 'YYYY-MM-DD'
 * @returns to 減 from 的天數
 */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY)
}

/**
 * 要顯示哪一天的行程：今天還有沒結束的就是今天，不然往後找第一個有行程的日子。
 * @param today 'YYYY-MM-DD'
 * @param now 現在時間 'HH:MM'
 * @param itemsOn 某一天的行程，end 是 'HH:MM'
 * @param horizon 最多往後找幾天
 * @returns 那一天和它的行程；找不到回 null
 */
export function pickAgenda<T extends { end: string }>(
  today: string,
  now: string,
  itemsOn: (date: string) => T[],
  horizon = 30,
): { date: string; items: T[] } | null {
  const todayItems = itemsOn(today)
  if (todayItems.some((item) => item.end > now)) return { date: today, items: todayItems }
  for (let days = 1; days <= horizon; days++) {
    const date = shiftDate(today, days)
    const items = itemsOn(date)
    if (items.length > 0) return { date, items }
  }
  return null
}

type TermDates = { code: string; start_date: string | null; end_date: string | null }

export type TermProgress =
  | { kind: 'in'; code: string; week: number; weeks: number; daysLeft: number; ratio: number }
  | { kind: 'before'; code: string; daysUntil: number }

/**
 * 學期進度。在學期中就是第幾週、還剩幾天；放假中就是離下學期開學幾天。
 * 起訖日期沒填齊的學期算不出來，跳過。
 * @param today 'YYYY-MM-DD'
 * @param terms 全部學期
 * @returns 進度；沒有進行中或排定的學期回 null
 */
export function termProgress(today: string, terms: TermDates[]): TermProgress | null {
  const dated = terms.filter(
    (term): term is TermDates & { start_date: string; end_date: string } =>
      !!term.start_date && !!term.end_date,
  )
  const current = dated.find((term) => term.start_date <= today && today <= term.end_date)
  if (current) {
    const length = daysBetween(current.start_date, current.end_date) + 1
    const passed = daysBetween(current.start_date, today)
    return {
      kind: 'in',
      code: current.code,
      week: Math.floor(passed / 7) + 1,
      weeks: Math.ceil(length / 7),
      daysLeft: daysBetween(today, current.end_date),
      ratio: (passed + 1) / length,
    }
  }
  const next = dated
    .filter((term) => term.start_date > today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
  return next ? { kind: 'before', code: next.code, daysUntil: daysBetween(today, next.start_date) } : null
}
