import type { SupabaseClient } from '@supabase/supabase-js'
import { periodIndex } from '@/app/lib/schedule/periods'
import type { Person } from './tutoring'

export type Semester = {
  id: string
  code: string
  // 課表只在這段期間有效；null 當作那一邊不設限
  start_date: string | null
  end_date: string | null
  // 考試週裡的任一天；null = 還不知道
  midterm_week: string | null
  final_week: string | null
}
export type Teacher = { id: string; name: string }
export type Course = {
  id: string
  semester_id: string
  name: string
  credits: number | null
  color: string
}
export type Slot = {
  id: string
  course_id: string
  teacher_id: string | null
  // 這一格是誰的課表（0008 加的）
  person_id: string | null
  day: number
  start_period: string
  end_period: string
  location: string | null
}

type Tables = {
  semesters: Semester
  teachers: Teacher
  courses: Course
  schedule_slots: Slot
}

export type Bootstrap = {
  semesters: Semester[]
  people: Person[]
  teachers: Teacher[]
  courses: Course[]
  slots: Slot[]
}

/**
 * 課表頁首屏要的東西，一趟撈完。最新的學期和排最前面的人在資料庫裡挑，
 * 連同他們的課程和時段一起回來，省掉「先問學期、再問課表」的第二趟往返。
 * @param supabase Supabase client
 * @returns 學期、成員、老師，以及最新學期第一個人的課程與時段
 */
export async function getBootstrap(supabase: SupabaseClient): Promise<Bootstrap> {
  const { data, error } = await supabase.rpc('get_schedule_bootstrap')
  if (error) throw error
  return data as Bootstrap
}

/**
 * 全部學期，新到舊。
 * @param supabase Supabase client
 * @returns 學期清單
 */
export async function getSemesters(supabase: SupabaseClient): Promise<Semester[]> {
  const { data, error } = await supabase
    .from('semesters')
    .select('id, code, start_date, end_date, midterm_week, final_week')
    .order('code', { ascending: false })
  if (error) throw error
  return data
}

/**
 * 全部老師，依名字排序。
 * @param supabase Supabase client
 * @returns 老師清單
 */
export async function getTeachers(supabase: SupabaseClient): Promise<Teacher[]> {
  const { data, error } = await supabase
    .from('teachers')
    .select('id, name')
    .order('name')
  if (error) throw error
  return data
}

/**
 * 某個學期的課程，依建立時間排序。
 * @param supabase Supabase client
 * @param semesterId 學期 id
 * @returns 課程清單
 */
export async function getCourses(
  supabase: SupabaseClient,
  semesterId: string,
): Promise<Course[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('id, semester_id, name, credits, color')
    .eq('semester_id', semesterId)
    .order('created_at')
  if (error) throw error
  return data
}

/**
 * 某個學期的時段。
 * @param supabase Supabase client
 * @param semesterId 學期 id
 * @param personId 只要這個人的課表；不給就是全部人的
 * @returns 時段清單
 */
export async function getSlots(
  supabase: SupabaseClient,
  semesterId: string,
  personId?: string,
): Promise<Slot[]> {
  const query = supabase
    .from('schedule_slots')
    .select(
      'id, course_id, teacher_id, person_id, day, start_period, end_period, location, courses!inner(semester_id)',
    )
    .eq('courses.semester_id', semesterId)
  const { data, error } = await (personId ? query.eq('person_id', personId) : query)
  if (error) throw error
  // courses 只是用來篩學期的，剝掉再回傳；跟著資料跑的話，
  // 拿這些列去 insert 會被 PostgREST 當成不存在的欄位擋下來
  return (data as unknown as (Slot & { courses: unknown })[]).map(
    ({ courses, ...slot }) => slot,
  )
}

/**
 * 把一個人的整份課表複製給另一個人。跟現有時段重疊的跳過，
 * 所以複製第二次不會疊出一堆垃圾。
 * @param supabase Supabase client
 * @param semesterId 學期 id
 * @param fromPersonId 來源
 * @param toPersonId 目的地
 * @returns 實際複製了幾筆
 */
export async function copySlots(
  supabase: SupabaseClient,
  semesterId: string,
  fromPersonId: string,
  toPersonId: string,
): Promise<number> {
  const [source, existing] = await Promise.all([
    getSlots(supabase, semesterId, fromPersonId),
    getSlots(supabase, semesterId, toPersonId),
  ])
  const rows = source
    .filter(
      (slot) =>
        !existing.some(
          (mine) =>
            mine.day === slot.day &&
            periodIndex(mine.start_period) <= periodIndex(slot.end_period) &&
            periodIndex(slot.start_period) <= periodIndex(mine.end_period),
        ),
    )
    .map((slot) => ({
      course_id: slot.course_id,
      teacher_id: slot.teacher_id,
      day: slot.day,
      start_period: slot.start_period,
      end_period: slot.end_period,
      location: slot.location,
      person_id: toPersonId,
    }))

  if (rows.length === 0) return 0
  const { error } = await supabase.from('schedule_slots').insert(rows)
  if (error) throw error
  return rows.length
}

/**
 * 新增一列。
 * @param supabase Supabase client
 * @param table 資料表
 * @param row 不含 id 的欄位
 * @returns 新增後的整列
 */
export async function insertRow<T extends keyof Tables>(
  supabase: SupabaseClient,
  table: T,
  row: Omit<Tables[T], 'id'>,
): Promise<Tables[T]> {
  // client 沒有產生型別，泛型對不上，型別檢查交給函式簽名
  const { data, error } = await supabase.from(table).insert(row as never).select().single()
  if (error) throw error
  return data
}

/**
 * 更新一列。
 * @param supabase Supabase client
 * @param table 資料表
 * @param id 要更新的列
 * @param patch 要改的欄位
 */
export async function updateRow<T extends keyof Tables>(
  supabase: SupabaseClient,
  table: T,
  id: string,
  patch: Partial<Omit<Tables[T], 'id'>>,
): Promise<void> {
  const { error } = await supabase.from(table).update(patch as never).eq('id', id)
  if (error) throw error
}

/**
 * 刪除一列。被外鍵擋下時丟出錯誤（code 23503）。
 * @param supabase Supabase client
 * @param table 資料表
 * @param id 要刪除的列
 */
export async function deleteRow(
  supabase: SupabaseClient,
  table: keyof Tables,
  id: string,
): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
}
