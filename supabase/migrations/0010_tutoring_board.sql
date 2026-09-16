-- 0010_tutoring_board.sql — 完善就學公開頁的資料（v1.6 Beta 7）
--
-- 公開頁不登入，資料表的 RLS 又只給 is_admin()，所以走這支 security definer 函式。
-- 只挑露得出去的欄位：時段的 note 不回；身分別、時薪本來就不存。
-- token 不對或連結關掉就回 null，頁面當 404。

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
        select json_agg(json_build_object('id', p.id, 'name', p.name, 'role', p.role)
          order by p.role, p.name)
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
