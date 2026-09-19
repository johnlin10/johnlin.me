-- 0014_exam_weeks.sql — 學期的期中考週與期末考週（v1.10.0）
--
-- 考試週不會跨週，所以只存一個日期，填那一週的哪一天都可以，週一到週五由程式推算。
-- 沒填就是還不知道，總覽頁不顯示那一場。

alter table public.semesters
  add column if not exists midterm_week date,
  add column if not exists final_week date;

-- 課表頁的學期表單讀這裡，少了這兩欄存檔會把它們清掉。
-- 只多回 semesters 兩個欄位，其餘跟 0012 的版本相同。
create or replace function public.get_schedule_bootstrap()
returns json
language sql
stable
set search_path to 'public'
as $function$
  with latest as (
    select id from semesters order by code desc limit 1
  ),
  first_person as (
    select id from people order by is_me desc, role, name limit 1
  )
  select json_build_object(
    'semesters', coalesce((
      select json_agg(json_build_object(
        'id', s.id, 'code', s.code, 'start_date', s.start_date, 'end_date', s.end_date,
        'midterm_week', s.midterm_week, 'final_week', s.final_week)
        order by s.code desc)
      from semesters s
    ), '[]'),
    'people', coalesce((
      select json_agg(json_build_object('id', p.id, 'name', p.name, 'role', p.role, 'is_me', p.is_me)
        order by p.is_me desc, p.role, p.name)
      from people p
    ), '[]'),
    'teachers', coalesce((
      select json_agg(json_build_object('id', t.id, 'name', t.name) order by t.name)
      from teachers t
    ), '[]'),
    'courses', coalesce((
      select json_agg(json_build_object(
        'id', c.id, 'semester_id', c.semester_id, 'name', c.name,
        'credits', c.credits, 'color', c.color) order by c.created_at)
      from courses c
      where c.semester_id = (select id from latest)
    ), '[]'),
    'slots', coalesce((
      select json_agg(json_build_object(
        'id', sl.id, 'course_id', sl.course_id, 'teacher_id', sl.teacher_id,
        'person_id', sl.person_id, 'day', sl.day, 'start_period', sl.start_period,
        'end_period', sl.end_period, 'location', sl.location))
      from schedule_slots sl
      join courses c on c.id = sl.course_id
      where c.semester_id = (select id from latest)
        and sl.person_id = (select id from first_person)
    ), '[]')
  );
$function$;
revoke all on function public.get_schedule_bootstrap() from public;
grant execute on function public.get_schedule_bootstrap() to authenticated;
