-- 0012_people_me.sql — 成員裡標出站主自己（v1.7.5）
--
-- 課表、完善就學都是自己的工具，成員清單一律把自己排第一：課表首屏載自己的，
-- 選單和疊課表比對也是自己排最前面、預設選自己。
-- 用欄位標記而不是比對名字，改名不會失效；partial unique index 保證最多一個人。

alter table public.people add column if not exists is_me boolean not null default false;
create unique index if not exists people_is_me_key on public.people (is_me) where is_me;
update public.people set is_me = true where name = '林昌龍';

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
        'id', s.id, 'code', s.code, 'start_date', s.start_date, 'end_date', s.end_date)
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

create or replace function public.get_tutoring_board(p_token text)
returns json
language sql
stable
security definer
set search_path to 'public'
as $function$
  with today as (
    select date_trunc('month', (now() at time zone 'Asia/Taipei'))::date as month_start
  ),
  -- 上個月到下個月；前後多一週，月初月底那幾週跨出去的日子也有資料
  range as (
    select
      (month_start - interval '1 month' - interval '7 days')::date as from_date,
      (month_start + interval '2 months' + interval '6 days')::date as to_date,
      to_char(month_start, 'YYYY-MM') as month
    from today
  )
  select case when exists (
    select 1 from tutoring_share where token = p_token and enabled
  ) then (
    select json_build_object(
      'month', range.month,
      'people', coalesce((
        select json_agg(json_build_object('id', p.id, 'name', p.name, 'role', p.role, 'is_me', p.is_me)
          order by p.is_me desc, p.role, p.name)
        from people p
      ), '[]'),
      'semesters', coalesce((
        select json_agg(json_build_object(
          'id', s.id, 'code', s.code, 'start_date', s.start_date, 'end_date', s.end_date)
          order by s.code desc)
        from semesters s
      ), '[]'),
      'slots', coalesce((
        select json_agg(json_build_object(
          'id', sl.id, 'person_id', sl.person_id, 'semester_id', c.semester_id,
          'day', sl.day, 'start_period', sl.start_period, 'end_period', sl.end_period,
          'location', sl.location, 'course', c.name))
        from schedule_slots sl
        join courses c on c.id = sl.course_id
        where sl.person_id is not null
      ), '[]'),
      'busy', coalesce((
        select json_agg(json_build_object(
          'id', b.id, 'person_id', b.person_id, 'semester_id', b.semester_id,
          'day', b.day, 'start_time', b.start_time, 'end_time', b.end_time, 'label', b.label))
        from tutoring_busy b
      ), '[]'),
      'sessions', coalesce((
        select json_agg(json_build_object(
          'id', ts.id, 'program', ts.program, 'date', ts.date,
          'start_time', ts.start_time, 'end_time', ts.end_time,
          'location', ts.location, 'teacher_id', ts.teacher_id,
          'attendees', coalesce((
            select json_agg(a.person_id) from tutoring_attendees a where a.session_id = ts.id
          ), '[]'))
          order by ts.date, ts.start_time)
        from tutoring_sessions ts
        where ts.date between range.from_date and range.to_date
      ), '[]'),
      -- 證照輔導的級距看累計時數，不限月份
      'license_hours', coalesce((
        select json_object_agg(person_id, hours)
        from (
          select a.person_id,
            sum(extract(epoch from ts.end_time - ts.start_time) / 3600) as hours
          from tutoring_sessions ts
          join tutoring_attendees a on a.session_id = ts.id
          where ts.program = 'license'
          group by a.person_id
        ) totals
      ), '{}')
    )
    from range
  ) end;
$function$;

revoke all on function public.get_tutoring_board(text) from public;
grant execute on function public.get_tutoring_board(text) to anon, authenticated;
