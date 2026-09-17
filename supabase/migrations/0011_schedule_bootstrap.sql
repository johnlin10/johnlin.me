-- 0011_schedule_bootstrap.sql — 課表頁首屏資料一次撈完（v1.7.2）
--
-- 課表頁原本分兩輪問資料：先 semesters + people，等它們回來才知道要載哪個學期、
-- 哪個人，再問 teachers + courses + schedule_slots。兩輪串著跑，從台灣到東京
-- 一趟 400ms 起跳，光是等這兩輪就花掉一秒多。
--
-- 這支函式把兩輪併成一趟：最新的學期和排在最前面的人在資料庫裡決定，
-- 當場把該載的 courses 和 slots 一起回傳。挑哪一筆的規則跟前端原本一致——
-- 學期是 code 由大到小的第一筆，人是 role、name 排序的第一筆。
--
-- 走 security invoker（預設），RLS 照舊把關；非管理員呼叫只會拿到空陣列。

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
    select id from people order by role, name limit 1
  )
  select json_build_object(
    'semesters', coalesce((
      select json_agg(json_build_object(
        'id', s.id, 'code', s.code, 'start_date', s.start_date, 'end_date', s.end_date)
        order by s.code desc)
      from semesters s
    ), '[]'),
    'people', coalesce((
      select json_agg(json_build_object('id', p.id, 'name', p.name, 'role', p.role)
        order by p.role, p.name)
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
