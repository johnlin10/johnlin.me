import type { SupabaseClient } from '@supabase/supabase-js'

export type Semester = { id: string; code: string }
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

/**
 * 全部學期，新到舊。
 * @param supabase Supabase client
 * @returns 學期清單
 */
export async function getSemesters(supabase: SupabaseClient): Promise<Semester[]> {
  const { data, error } = await supabase
    .from('semesters')
    .select('id, code')
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
 * 某個學期的所有時段。
 * @param supabase Supabase client
 * @param semesterId 學期 id
 * @returns 時段清單
 */
export async function getSlots(
  supabase: SupabaseClient,
  semesterId: string,
): Promise<Slot[]> {
  const { data, error } = await supabase
    .from('schedule_slots')
    .select(
      'id, course_id, teacher_id, day, start_period, end_period, location, courses!inner(semester_id)',
    )
    .eq('courses.semester_id', semesterId)
  if (error) throw error
  return data
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
