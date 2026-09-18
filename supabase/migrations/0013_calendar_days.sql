-- 0013_calendar_days.sql — 放假與補課的日子（v1.9.0）
--
-- 課表是週課表，沒有日期，所以國定假日照樣長出課來；完善就學也擋不掉假日排程。
-- 這張表就是那份例外清單：一天一列，決定那天要套哪一天的課表。
--
-- source_day 為 null 是放假，那天不套任何課表；填 1..7 是補課日，
-- 那天改上那個星期幾的課。補假清一色落在週一或週五（節日在週二或週四，
-- 順著週末放四天），補課則多半排在週六。
--
-- 沒有「補班日」這種列：2025 年修法後政府已經取消補班，開放資料裡查不到，
-- 學校要補哪一天是學校自己決定的，一律手動填。

create table if not exists public.calendar_days (
  date date primary key,
  -- null = 放假；1 = 週一 … 7 = 週日，那天改上這一天的課
  source_day smallint,
  label text not null,         -- '中秋節' / '補假' / '補 4/3 的課'
  created_at timestamptz not null default now(),
  constraint calendar_days_source_day_check
    check (source_day between 1 and 7),
  constraint calendar_days_label_check
    check (btrim(label) <> '')
);

alter table public.calendar_days enable row level security;

drop policy if exists calendar_days_admin_all on public.calendar_days;
create policy calendar_days_admin_all on public.calendar_days
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- 公開頁也要知道哪天放假，不然疊出來的課表在假日那一欄是錯的。
-- 只多回 calendar 一段，其餘跟 0012 的版本相同。
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
      'calendar', coalesce((
        select json_agg(json_build_object(
          'date', cd.date, 'source_day', cd.source_day, 'label', cd.label)
          order by cd.date)
        from calendar_days cd
        where cd.date between range.from_date and range.to_date
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
