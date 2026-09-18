import type { SupabaseClient } from '@supabase/supabase-js'
import { getSemesters, type Semester } from './schedule'
import { getCalendarDays, type CalendarDay } from './calendar'

export type MyClass = {
  id: string
  semester_id: string
  day: number
  start_period: string
  end_period: string
  location: string | null
  course: string
  color: string
}

export type MySession = {
  id: string
  program: string
  date: string
  start_time: string
  end_time: string
  location: string | null
}

export type Overview = {
  semesters: Semester[]
  calendar: CalendarDay[]
  classes: MyClass[]
  sessions: MySession[]
  // 近 7 天全部短網址的點擊
  clicks: number
}

type ClassRow = Omit<MyClass, 'semester_id' | 'course' | 'color'> & {
  courses: { name: string; semester_id: string; color: string }
}

/**
 * tools 總覽要的資料：自己每個學期的課、自己參加的輔導時段、近期點擊數。
 * @param supabase Supabase client
 * @param from 輔導時段起日 'YYYY-MM-DD'
 * @param to 輔導時段迄日 'YYYY-MM-DD'
 * @param since 點擊從這個時間點算起（ISO）
 * @returns 總覽資料
 */
export async function getOverview(
  supabase: SupabaseClient,
  from: string,
  to: string,
  since: string,
): Promise<Overview> {
  const [semesters, calendar, classes, sessions, clicks] = await Promise.all([
    getSemesters(supabase),
    getCalendarDays(supabase),
    supabase
      .from('schedule_slots')
      .select('id, day, start_period, end_period, location, courses!inner(name, semester_id, color), people!inner()')
      .eq('people.is_me', true),
    supabase
      .from('tutoring_sessions')
      .select('id, program, date, start_time, end_time, location, tutoring_attendees!inner(people!inner())')
      .eq('tutoring_attendees.people.is_me', true)
      .gte('date', from)
      .lte('date', to)
      .order('date')
      .order('start_time'),
    supabase
      .from('short_link_clicks')
      .select('*', { count: 'exact', head: true })
      .gte('clicked_at', since),
  ])
  if (classes.error) throw classes.error
  if (sessions.error) throw sessions.error
  if (clicks.error) throw clicks.error

  return {
    semesters,
    calendar,
    classes: (classes.data as unknown as ClassRow[]).map(({ courses, ...slot }) => ({
      ...slot,
      semester_id: courses.semester_id,
      course: courses.name,
      color: courses.color,
    })),
    sessions: (sessions.data as unknown as (MySession & { tutoring_attendees: unknown })[]).map(
      ({ tutoring_attendees, ...session }) => session,
    ),
    clicks: clicks.count ?? 0,
  }
}
