-- 0008_shared_timetables.sql — 課表變成大家的（v1.6 Beta 4）
--
-- 同學和老師的課表不再手動輸入一份，改成跟你一樣建在課表工具裡，
-- 完善就學直接讀。成員表因此不再只屬於完善就學，改名 people。

alter table if exists public.tutoring_people rename to people;

-- 課表的每一格屬於誰。課程和老師仍然跨人共用：同班的一門課只建一次，
-- 每個人各自標自己的時段，顏色也因此一致
alter table public.schedule_slots
  add column if not exists person_id uuid references public.people(id) on delete cascade;

-- 既有的課表都是你的，掛到標了 from_schedule 的那個人身上
update public.schedule_slots
  set person_id = (select id from public.people where from_schedule limit 1)
  where person_id is null;

-- 每個人都從課表讀，不再需要這個標記
alter table public.people drop column if exists from_schedule;

create index if not exists schedule_slots_person_idx
  on public.schedule_slots (person_id);

alter policy tutoring_people_admin_all on public.people rename to people_admin_all;
