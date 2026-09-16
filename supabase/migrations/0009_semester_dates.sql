-- 0009_semester_dates.sql — 學期有起訖日期（v1.6 Beta 5）
--
-- 課表只在學期期間有效。沒有日期的話，開學前、寒暑假也會被當成有課，
-- 完善就學就會擋掉那些其實排得進去的時段。
-- 兩個日期都可以不填，沒填的那一邊當作不設限，舊資料的行為不變。

alter table public.semesters
  add column if not exists start_date date,
  add column if not exists end_date date;

alter table public.semesters
  drop constraint if exists semesters_date_range_check;
alter table public.semesters
  add constraint semesters_date_range_check
  check (start_date is null or end_date is null or end_date >= start_date);
