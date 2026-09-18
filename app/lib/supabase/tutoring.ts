import type { SupabaseClient } from '@supabase/supabase-js'
import { PERIODS, periodIndex } from '@/app/lib/schedule/periods'
import { addDays, dateKey, weeksOfMonth } from '@/app/lib/tutoring'
import { getCourses, getSemesters, getSlots, type Semester } from './schedule'
import { getCalendarDays, type CalendarDay } from './calendar'

export type Person = {
  id: string
  name: string
  role: 'student' | 'teacher'
  // 站主自己，永遠排第一（0012）
  is_me: boolean
}

export type BusySlot = {
  id: string
  person_id: string
  semester_id: string
  day: number
  start_time: string
  end_time: string
  label: string | null
}

export type SessionFields = {
  program: string
  date: string
  start_time: string
  end_time: string
  location: string | null
  teacher_id: string | null
  note: string | null
}

export type Session = SessionFields & { id: string; attendees: string[] }

// 公開頁拿到的時段，沒有備註
export type PublicSession = Omit<Session, 'note'>

export type ScheduleSlot = {
  id: string
  person_id: string | null
  day: number
  start_period: string
  end_period: string
  location: string | null
}

export type Board = {
  // 伺服器上台灣時間的這個月，公開頁只能看它的前後一個月
  month: string
  people: Person[]
  semesters: { id: string; code: string; start_date: string | null; end_date: string | null }[]
  calendar: CalendarDay[]
  slots: (ScheduleSlot & { semester_id: string; course: string })[]
  busy: BusySlot[]
  sessions: PublicSession[]
  license_hours: Record<string, number>
}

export type Share = { token: string; enabled: boolean }

export type Members = { people: Person[]; busy: BusySlot[]; scheduleBusy: BusySlot[] }

export type MonthSessions = { sessions: Session[]; license: Session[] }

// 管理頁的首屏資料
export type Tutoring = Members &
  MonthSessions & {
    month: string
    semesters: Semester[]
    share: Share | null
    calendar: CalendarDay[]
  }

const SESSION_COLUMNS =
  'id, program, date, start_time, end_time, location, teacher_id, note, tutoring_attendees(person_id)'

type SessionRow = Omit<Session, 'attendees'> & { tutoring_attendees: { person_id: string }[] }

/**
 * 全部成員，自己排第一，老師排在學生後面，各自依名字排序。
 * @param supabase Supabase client
 * @returns 成員清單
 */
export async function getPeople(supabase: SupabaseClient): Promise<Person[]> {
  const { data, error } = await supabase
    .from('people')
    .select('id, name, role, is_me')
    .order('is_me', { ascending: false })
    .order('role')
    .order('name')
  if (error) throw error
  return data
}

/**
 * 所有人、所有學期的忙碌時段。哪一天套用哪一筆，由學期的起訖日期決定。
 * @param supabase Supabase client
 * @returns 忙碌時段清單
 */
export async function getBusy(supabase: SupabaseClient): Promise<BusySlot[]> {
  const { data, error } = await supabase
    .from('tutoring_busy')
    .select('id, person_id, semester_id, day, start_time, end_time, label')
    .order('day')
    .order('start_time')
  if (error) throw error
  return data
}

/**
 * 一段日期範圍裡的輔導時段，參與者攤平成 id 陣列。
 * @param supabase Supabase client
 * @param from 起日 'YYYY-MM-DD'
 * @param to 迄日 'YYYY-MM-DD'
 * @returns 時段清單
 */
export async function getSessions(
  supabase: SupabaseClient,
  from: string,
  to: string,
): Promise<Session[]> {
  const { data, error } = await supabase
    .from('tutoring_sessions')
    .select(SESSION_COLUMNS)
    .gte('date', from)
    .lte('date', to)
    .order('date')
    .order('start_time')
  if (error) throw error
  return (data as unknown as SessionRow[]).map(({ tutoring_attendees, ...session }) => ({
    ...session,
    attendees: tutoring_attendees.map((row) => row.person_id),
  }))
}

/**
 * 某個方案的全部時段，不限日期。證照輔導的級距看的是開課總時數，所以要累計。
 * @param supabase Supabase client
 * @param program 方案代號
 * @returns 時段清單
 */
export async function getSessionsOf(
  supabase: SupabaseClient,
  program: string,
): Promise<Session[]> {
  const { data, error } = await supabase
    .from('tutoring_sessions')
    .select(SESSION_COLUMNS)
    .eq('program', program)
  if (error) throw error
  return (data as unknown as SessionRow[]).map(({ tutoring_attendees, ...session }) => ({
    ...session,
    attendees: tutoring_attendees.map((row) => row.person_id),
  }))
}

/**
 * 一個月畫面上看得到的時段（跨月的頭尾兩週也算），加上證照輔導不分月份的全部時段。
 * @param supabase Supabase client
 * @param month 'YYYY-MM'
 * @returns 這個月的時段和證照輔導的時段
 */
export async function getMonthSessions(
  supabase: SupabaseClient,
  month: string,
): Promise<MonthSessions> {
  const weeks = weeksOfMonth(month)
  const [sessions, license] = await Promise.all([
    getSessions(supabase, dateKey(weeks[0]), dateKey(addDays(weeks[weeks.length - 1], 6))),
    getSessionsOf(supabase, 'license'),
  ])
  return { sessions, license }
}

/**
 * 成員和他們的忙碌時段。每個學期的課表都讀進來，哪一天套哪一份由學期的起訖日期決定。
 * @param supabase Supabase client
 * @param semesterIds 全部學期 id
 * @returns 成員、自己維護的忙碌時段、課表換算來的忙碌時段
 */
export async function getMembers(
  supabase: SupabaseClient,
  semesterIds: string[],
): Promise<Members> {
  const [people, busy, scheduleLists] = await Promise.all([
    getPeople(supabase),
    getBusy(supabase),
    Promise.all(semesterIds.map((id) => getScheduleBusy(supabase, id))),
  ])
  return { people, busy, scheduleBusy: scheduleLists.flat() }
}

/**
 * 管理頁的首屏資料。
 * @param supabase Supabase client
 * @param month 先載入哪個月 'YYYY-MM'
 * @returns 首屏資料
 */
export async function getTutoring(supabase: SupabaseClient, month: string): Promise<Tutoring> {
  const [semesters, monthSessions, share, calendar] = await Promise.all([
    getSemesters(supabase),
    getMonthSessions(supabase, month),
    getShare(supabase),
    getCalendarDays(supabase),
  ])
  const members = await getMembers(
    supabase,
    semesters.map((semester) => semester.id),
  )
  return { month, semesters, share, calendar, ...members, ...monthSessions }
}

/**
 * 新增或更新一個輔導時段，順便換掉參與者名單。
 * ponytail: 時段和參與者分兩次寫，中間斷線會留下沒有參與者的時段；一個人用，重存一次就好
 * @param supabase Supabase client
 * @param fields 時段欄位
 * @param attendees 參與者 id
 * @param id 有就是更新
 */
export async function saveSession(
  supabase: SupabaseClient,
  fields: SessionFields,
  attendees: string[],
  id?: string,
): Promise<void> {
  let sessionId = id
  if (sessionId) {
    const { error } = await supabase.from('tutoring_sessions').update(fields).eq('id', sessionId)
    if (error) throw error
    const { error: clearError } = await supabase
      .from('tutoring_attendees')
      .delete()
      .eq('session_id', sessionId)
    if (clearError) throw clearError
  } else {
    const { data, error } = await supabase
      .from('tutoring_sessions')
      .insert(fields)
      .select('id')
      .single()
    if (error) throw error
    sessionId = data.id
  }

  if (attendees.length === 0) return
  const { error } = await supabase
    .from('tutoring_attendees')
    .insert(attendees.map((person_id) => ({ session_id: sessionId, person_id })))
  if (error) throw error
}

/**
 * 新增或更新一位成員。
 * @param supabase Supabase client
 * @param fields 名字和角色
 * @param id 有就是更新
 */
export async function savePerson(
  supabase: SupabaseClient,
  fields: { name: string; role: string },
  id?: string,
): Promise<void> {
  const { error } = id
    ? await supabase.from('people').update(fields).eq('id', id)
    : await supabase.from('people').insert(fields)
  if (error) throw error
}

/**
 * 把課表工具裡所有人的課換算成忙碌時段。
 * @param supabase Supabase client
 * @param semesterId 學期 id
 * @returns 忙碌時段（id 帶 schedule- 前綴，不是 tutoring_busy 的列）
 */
export async function getScheduleBusy(
  supabase: SupabaseClient,
  semesterId: string,
): Promise<BusySlot[]> {
  const [slots, courses] = await Promise.all([
    getSlots(supabase, semesterId),
    getCourses(supabase, semesterId),
  ])
  const nameById = new Map(courses.map((course) => [course.id, course.name]))
  return slotsToBusy(
    slots.map((slot) => ({
      ...slot,
      semester_id: semesterId,
      course: nameById.get(slot.course_id),
    })),
  )
}

/**
 * 課表格子換算成忙碌時段。節次的起訖時間對照 PERIODS，所以 PERIODS 有多準，這裡就有多準。
 * @param slots 課表格子，帶學期和課名
 * @returns 忙碌時段（id 帶 schedule- 前綴，不是 tutoring_busy 的列）
 */
export function slotsToBusy(
  slots: (ScheduleSlot & { semester_id: string; course?: string })[],
): BusySlot[] {
  return slots.flatMap((slot) => {
    const start = PERIODS[periodIndex(slot.start_period)]
    const end = PERIODS[periodIndex(slot.end_period)]
    if (!start || !end || !slot.person_id) return []
    return [
      {
        id: `schedule-${slot.id}`,
        person_id: slot.person_id,
        semester_id: slot.semester_id,
        day: slot.day,
        start_time: start.start,
        end_time: end.end,
        label: [slot.course, slot.location].filter(Boolean).join(' · ') || null,
      },
    ]
  })
}

/**
 * 公開頁的全部資料，一次拿完。
 * @param supabase Supabase client（匿名的就好）
 * @param token 連結上的 token
 * @returns token 不對或連結關掉回 null
 */
export async function getBoard(supabase: SupabaseClient, token: string): Promise<Board | null> {
  const { data, error } = await supabase.rpc('get_tutoring_board', { p_token: token })
  if (error) throw error
  return data
}

/**
 * 公開連結的設定。
 * @param supabase Supabase client
 * @returns 還沒建立過回 null
 */
export async function getShare(supabase: SupabaseClient): Promise<Share | null> {
  const { data, error } = await supabase
    .from('tutoring_share')
    .select('token, enabled')
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * 寫入公開連結的設定。表只有一列，所以一律 upsert。
 * @param supabase Supabase client
 * @param share token 和開關
 */
export async function saveShare(supabase: SupabaseClient, share: Share): Promise<void> {
  const { error } = await supabase.from('tutoring_share').upsert({ id: true, ...share })
  if (error) throw error
}

/**
 * 產生新的 token：10 碼英數字，換掉之後舊連結立刻失效。
 * @returns token
 */
export function newToken(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  // 256 除以 56 有餘數，前面幾個字元機率略高；10 碼、猜不到就好，不影響
  return Array.from(
    crypto.getRandomValues(new Uint8Array(10)),
    (byte) => chars[byte % chars.length],
  ).join('')
}

/**
 * 新增或更新一段忙碌時段。
 * @param supabase Supabase client
 * @param fields 時段欄位
 * @param id 有就是更新
 */
export async function saveBusy(
  supabase: SupabaseClient,
  fields: Omit<BusySlot, 'id'>,
  id?: string,
): Promise<void> {
  const { error } = id
    ? await supabase.from('tutoring_busy').update(fields).eq('id', id)
    : await supabase.from('tutoring_busy').insert(fields)
  if (error) throw error
}

/**
 * 刪除一列。參與者和忙碌時段會跟著成員一起走（on delete cascade）。
 * @param supabase Supabase client
 * @param table 資料表
 * @param id 要刪除的列
 */
export async function deleteFrom(
  supabase: SupabaseClient,
  table: 'people' | 'tutoring_busy' | 'tutoring_sessions',
  id: string,
): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
}
