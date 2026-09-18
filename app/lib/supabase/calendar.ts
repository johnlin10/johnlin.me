import type { SupabaseClient } from '@supabase/supabase-js'
import type { CalendarDay } from '@/app/lib/tutoring'

export type { CalendarDay }

/**
 * 放假和補課的日子，全部。一年只有十幾列，切月份、翻頁都不必重抓。
 * @param supabase Supabase client
 * @returns 依日期排序的清單
 */
export async function getCalendarDays(supabase: SupabaseClient): Promise<CalendarDay[]> {
  const { data, error } = await supabase
    .from('calendar_days')
    .select('date, source_day, label')
    .order('date')
  if (error) throw error
  return data
}

/**
 * 新增或覆蓋一天。日期是主鍵，同一天改過來就是覆蓋。
 * @param supabase Supabase client
 * @param day 那一天的設定
 */
export async function saveCalendarDay(
  supabase: SupabaseClient,
  day: CalendarDay,
): Promise<void> {
  const { error } = await supabase.from('calendar_days').upsert(day)
  if (error) throw error
}

/**
 * 一次寫進多天，已經有的日期跳過。匯入用。
 * @param supabase Supabase client
 * @param days 要寫入的日子
 * @returns 實際寫進幾筆
 */
export async function importCalendarDays(
  supabase: SupabaseClient,
  days: CalendarDay[],
): Promise<number> {
  if (days.length === 0) return 0
  // ignoreDuplicates：自己手動改過的日子不要被政府版本蓋掉
  const { data, error } = await supabase
    .from('calendar_days')
    .upsert(days, { onConflict: 'date', ignoreDuplicates: true })
    .select('date')
  if (error) throw error
  return data.length
}

/**
 * 刪掉一天。
 * @param supabase Supabase client
 * @param date 'YYYY-MM-DD'
 */
export async function deleteCalendarDay(
  supabase: SupabaseClient,
  date: string,
): Promise<void> {
  const { error } = await supabase.from('calendar_days').delete().eq('date', date)
  if (error) throw error
}
