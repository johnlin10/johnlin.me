// 完善就學的算法：時間、方案、時數。規定見 docs/tutoring-plan.md
// 輔導時段不對齊學校節次，一律用實際時間；規定是最少 1 小時、往上每 0.5 小時一階
export const DAY_START = 8 * 60
export const DAY_END = 22 * 60
export const STEP = 30
export const MIN_MINUTES = 60

export type TimeRange = { start: string; end: string }

/**
 * 時間字串轉成從 0 點起算的分鐘。
 * @param time 'HH:MM' 或 Postgres 回來的 'HH:MM:SS'
 * @returns 分鐘
 */
export function minutesOf(time: string): number {
  const [hour, minute] = time.split(':')
  return Number(hour) * 60 + Number(minute)
}

/**
 * 分鐘轉回時間字串。
 * @param minutes 從 0 點起算的分鐘
 * @returns 'HH:MM'
 */
export function timeLabel(minutes: number): string {
  const hour = Math.floor(minutes / 60)
  return `${String(hour).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

// 起訖共用同一份，08:00 到 22:00 每半小時一個
export const TIME_OPTIONS = Array.from(
  { length: (DAY_END - DAY_START) / STEP + 1 },
  (_, i) => timeLabel(DAY_START + i * STEP),
)

// 規定的時長：1 到 8 小時，每 0.5 小時一階。開始時間不受這個限制，
// 15:20 開始上兩小時一樣合規，所以顆粒度只套在長度上
export const DURATION_OPTIONS = Array.from({ length: 15 }, (_, i) => 1 + i * 0.5)

/**
 * 開始時間加上時長算出結束時間。
 * @param start 開始時間
 * @param hours 時長（小時）
 * @returns 'HH:MM'；跨過午夜回 null
 */
export function endOf(start: string, hours: number): string | null {
  const minutes = minutesOf(start) + hours * 60
  return minutes > 24 * 60 ? null : timeLabel(minutes)
}

/**
 * 時段長度，不合規定就回 null。
 * @param start 開始時間
 * @param end 結束時間
 * @returns 小時數；短於 1 小時或不是 0.5 的倍數回 null
 */
export function durationHours(start: string, end: string): number | null {
  const minutes = minutesOf(end) - minutesOf(start)
  if (minutes < MIN_MINUTES || minutes % STEP !== 0) return null
  return minutes / 60
}

/**
 * 兩個時間區間有沒有交集。呼叫端自己確認是同一天。
 * @param a 時間區間
 * @param b 時間區間
 * @returns 有交集回 true
 */
export function timeOverlaps(a: TimeRange, b: TimeRange): boolean {
  return minutesOf(a.start) < minutesOf(b.end) && minutesOf(b.start) < minutesOf(a.end)
}

/**
 * 日期是星期幾，跟資料庫的 day 欄位同一套編號。
 * @param date 'YYYY-MM-DD'
 * @returns 1 = 週一 … 7 = 週日
 */
export function dayOfWeek(date: string): number {
  // 不加時間的話會被當成 UTC 午夜，台灣時區會倒退一天
  const day = new Date(`${date}T00:00:00`).getDay()
  return day === 0 ? 7 : day
}

export type CalendarDay = { date: string; source_day: number | null; label: string }

/**
 * 那一天要套哪一天的課表。課表是週課表，放假和補課都是靠這裡換算出來的。
 * @param date 'YYYY-MM-DD'
 * @param calendar 日期對照表，只有例外的日子在裡面
 * @returns 1 = 週一 … 7 = 週日；放假回 null
 */
export function classDay(date: string, calendar: Map<string, CalendarDay>): number | null {
  const day = calendar.get(date)
  // 放假的 source_day 就是 null，補課日是被補的那天
  return day ? day.source_day : dayOfWeek(date)
}

/**
 * 日期對照表。
 * @param days 資料庫回來的列
 * @returns 日期 → 設定
 */
export function calendarMap(days: CalendarDay[]): Map<string, CalendarDay> {
  return new Map(days.map((day) => [day.date, day]))
}

/**
 * 某一天在不在學期期間。課表只在這段期間有效，開學前和寒暑假不算有課。
 * @param date 'YYYY-MM-DD'
 * @param start 開學日；null 當作不設限
 * @param end 結束日（含當天）；null 當作不設限
 * @returns 在期間內回 true
 */
export function inTerm(date: string, start: string | null, end: string | null): boolean {
  // 'YYYY-MM-DD' 照字串比就是照日期比
  return (!start || date >= start) && (!end || date <= end)
}

export type Term = { id: string; start_date: string | null; end_date: string | null }

/**
 * 某個學期的課表在這一天算不算數。
 * 舊學期要兩個日期都填了才算，不然它的課會套到每一週，連現在這學期也被擋。
 * @param semesterId 課表所屬學期
 * @param date 'YYYY-MM-DD'
 * @param terms 全部學期，最新的排第一個
 * @returns 算數回 true
 */
export function slotInEffect(semesterId: string, date: string, terms: Term[]): boolean {
  const term = terms.find((item) => item.id === semesterId)
  if (!term) return false
  if (term !== terms[0] && !(term.start_date && term.end_date)) return false
  return inTerm(date, term.start_date, term.end_date)
}

/**
 * 本地時間的日期字串。
 * @param date Date
 * @returns 'YYYY-MM-DD'
 */
export function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * 日期往後幾天。
 * @param date 起點
 * @param days 天數，可以是負的
 * @returns 新的 Date
 */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/**
 * 那一天所在的週一。
 * @param date 任何一天
 * @returns 週一的 Date
 */
export function weekStart(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7))
}

/**
 * 月份裡的每一週，跨月的頭尾兩週也算進去。只有週末落在這個月的那一週不算。
 * @param month 'YYYY-MM'
 * @returns 每一週的週一
 */
export function weeksOfMonth(month: string): Date[] {
  const [year, index] = month.split('-').map(Number)
  const first = new Date(year, index - 1, 1)
  const last = new Date(year, index, 0)
  let day = weekStart(first)
  // 1 號是週六、週日的話，那一週的週一到週五全在上個月
  if (addDays(day, 4) < first) day = addDays(day, 7)
  const weeks: Date[] = []
  for (; day <= last; day = addDays(day, 7)) weeks.push(day)
  return weeks
}

/**
 * 一週歸哪個月。跨月的那一週兩個月都列得到，但只能算一個：看週三，週一到週五多數落在哪就是哪。
 * @param week 那一週的週一
 * @returns 'YYYY-MM'
 */
export function monthOfWeek(week: Date): string {
  return dateKey(addDays(week, 2)).slice(0, 7)
}

/**
 * 月份往後幾個月。
 * @param month 'YYYY-MM'
 * @param delta 月數，可以是負的
 * @returns 'YYYY-MM'
 */
export function shiftMonth(month: string, delta: number): string {
  const [year, index] = month.split('-').map(Number)
  const date = new Date(year, index - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * 同一天裡互相重疊的時段要並排，算出每個時段站哪一欄。
 * 重疊的連成一群，群內貪婪配欄，同群的欄數一致才不會寬度參差。
 * @param items 同一天的時段
 * @returns id → 第幾欄、這一群共幾欄
 */
export function layoutLanes(
  items: { id: string; start: string; end: string }[],
): Map<string, { lane: number; lanes: number }> {
  const sorted = items
    .map((item) => ({ id: item.id, start: minutesOf(item.start), end: minutesOf(item.end) }))
    .sort((a, b) => a.start - b.start || a.end - b.end)

  const lanes = new Map<string, { lane: number; lanes: number }>()
  let group: string[] = []
  let laneEnds: number[] = []
  let groupEnd = -1

  const flush = () => {
    for (const id of group) lanes.get(id)!.lanes = laneEnds.length
    group = []
    laneEnds = []
    groupEnd = -1
  }

  for (const item of sorted) {
    if (item.start >= groupEnd) flush()
    let lane = laneEnds.findIndex((end) => end <= item.start)
    if (lane < 0) lane = laneEnds.push(0) - 1
    laneEnds[lane] = item.end
    lanes.set(item.id, { lane, lanes: 0 })
    group.push(item.id)
    groupEnd = Math.max(groupEnd, item.end)
  }
  flush()

  return lanes
}

// capped 的三個方案每人每月合計不能超過 MONTHLY_CAP；證照輔導是另一套級距，不進合計
// 顏色對照 app/lib/schedule/colors.ts 的 key
export const PROGRAMS = [
  { key: 'after_class', color: 'blue', capped: true },
  { key: 'peer', color: 'green', capped: true },
  { key: 'contest', color: 'orange', capped: true },
  { key: 'license', color: 'violet', capped: false },
] as const

export type ProgramKey = (typeof PROGRAMS)[number]['key']

export const MONTHLY_CAP = 40

export type HoursByProgram = Record<ProgramKey, number> & { capped: number }

// 算時數只需要這幾個欄位，不綁資料庫的型別
type CountableSession = {
  program: string
  start_time: string
  end_time: string
  attendees: string[]
}

/**
 * 方案的顏色 key，不認得的方案當灰色。
 * @param key 方案代號
 * @returns 顏色 key
 */
export function programColor(key: string): string {
  return PROGRAMS.find((program) => program.key === key)?.color ?? 'gray'
}

/**
 * 全部歸零的時數。
 * @returns 每個方案都是 0 的時數
 */
export function emptyHours(): HoursByProgram {
  return {
    ...(Object.fromEntries(PROGRAMS.map((p) => [p.key, 0])) as Record<ProgramKey, number>),
    capped: 0,
  }
}

/**
 * 每人的時數統計。篩月份是呼叫端的事，證照輔導的累計就是不篩直接丟進來。
 * 老師不在參與者裡，所以不會被算到。
 * @param sessions 要算的時段
 * @returns person_id → 各方案時數和受上限的合計
 */
export function sumHours(sessions: CountableSession[]): Map<string, HoursByProgram> {
  const totals = new Map<string, HoursByProgram>()

  for (const session of sessions) {
    const program = PROGRAMS.find((p) => p.key === session.program)
    const hours = durationHours(session.start_time, session.end_time)
    // 資料庫的 check 擋過了，這裡只是不讓髒資料算出奇怪的總數
    if (!program || hours === null) continue

    for (const personId of session.attendees) {
      const row = totals.get(personId) ?? emptyHours()
      row[program.key] += hours
      if (program.capped) row.capped += hours
      totals.set(personId, row)
    }
  }

  return totals
}
