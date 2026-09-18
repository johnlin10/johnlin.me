// 從 ics 讀國定假日。抓取和權限在 app/api/admin/holidays/route.ts

// Google 的「台灣的節慶假日」。政府開放資料的辦公日曆表只有 CSV，而且每年一份、
// 要靠中文標題去 metadata 裡撈；這份是固定網址，一次涵蓋多年。
// 過濾成平日的國定假日之後，逐筆對得上辦公日曆表的「平日放假」。
export const ICS_URL =
  'https://calendar.google.com/calendar/ical/zh-tw.taiwan%23holiday%40group.v.calendar.google.com/public/basic.ics'

// 這份行事曆把不放假的民俗節日（元宵、冬至、婦女節…）也放進來，靠 DESCRIPTION 分
const HOLIDAY_DESCRIPTION = '國定假日'

export type ImportedDay = { date: string; label: string }

/**
 * 從 ics 挑出平日的國定假日。
 * @param ics ics 全文
 * @param years 只要這幾年的，例如 ['2026', '2027']
 * @returns 日期和名稱，依日期排序
 */
export function parseHolidays(ics: string, years: string[]): ImportedDay[] {
  // RFC 5545 的折行：接續行以空白或 tab 開頭，先接回去再解析
  const unfolded = ics.replace(/\r?\n[ \t]/g, '')
  const field = (block: string, name: string) =>
    new RegExp(`^${name}[^:\\r\\n]*:(.*)$`, 'm').exec(block)?.[1]?.trim()

  const days = unfolded
    .split('BEGIN:VEVENT')
    .slice(1)
    .flatMap((block) => {
      const start = field(block, 'DTSTART')
      const summary = field(block, 'SUMMARY')
      if (!start || !summary) return []
      if (!field(block, 'DESCRIPTION')?.startsWith(HOLIDAY_DESCRIPTION)) return []
      // 全天事件是 YYYYMMDD
      const date = `${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}`
      if (!years.includes(date.slice(0, 4))) return []
      // 週末本來就沒課，寫進去只是雜訊。不用 tutoring.ts 的 dayOfWeek：
      // Node 跑 .mjs 測試時剝離 TS 的相對 import 解不到，這個檔就測不了
      if ([0, 6].includes(new Date(`${date}T00:00:00`).getDay())) return []
      return [{ date, label: summary }]
    })

  // 同一天重複出現時留第一筆
  return [...new Map(days.map((day) => [day.date, day])).values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  )
}
