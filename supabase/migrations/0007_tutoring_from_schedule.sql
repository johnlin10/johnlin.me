-- 0007_tutoring_from_schedule.sql — 我的課表不再輸入第二次（v1.6 Beta 3）
--
-- 標記哪一位成員的忙碌時段直接讀 schedule_slots，不自己維護一份。

alter table public.tutoring_people
  add column if not exists from_schedule boolean not null default false;

-- 課表工具裡只有你一個人的課，所以最多一位成員能標
create unique index if not exists tutoring_people_from_schedule_idx
  on public.tutoring_people (from_schedule)
  where from_schedule;
