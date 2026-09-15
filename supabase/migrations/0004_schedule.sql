-- 0004_schedule.sql — 課表（v1.5 Beta 2）
--
-- 學期、老師、課程、時段四張表，只有管理員讀寫，訪客完全讀不到。
-- 設計理由見 docs/tools-plan.md 第四節。

create table if not exists public.semesters (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,   -- '114-1'，排序直接用它
  created_at timestamptz not null default now(),
  constraint semesters_code_format_check
    check (code ~ '^\d{3}-[12]$')
);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  constraint teachers_name_check
    check (btrim(name) <> '')
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  -- 學期底下還有課程就刪不掉
  semester_id uuid not null references public.semesters(id) on delete restrict,
  name text not null,
  credits smallint,            -- null = 還沒填，跟 0 學分分開
  color text not null,         -- 顏色 key，對照 app/lib/schedule/colors.ts
  created_at timestamptz not null default now(),
  constraint courses_semester_name_unique
    unique (semester_id, name),
  constraint courses_name_check
    check (btrim(name) <> ''),
  constraint courses_credits_check
    check (credits >= 0),
  constraint courses_color_format_check
    check (color ~ '^[a-z]+$')
);

create table if not exists public.schedule_slots (
  id uuid primary key default gen_random_uuid(),
  -- 學期由課程決定；還有時段在用的課程刪不掉
  course_id uuid not null references public.courses(id) on delete restrict,
  -- 老師刪掉，時段留著，只是沒有老師
  teacher_id uuid references public.teachers(id) on delete set null,
  day smallint not null,       -- 1 = 週一 … 7 = 週日
  start_period text not null,  -- 節次代號，對照 app/lib/schedule/periods.ts
  end_period text not null,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_slots_day_check
    check (day between 1 and 7)
);

create index if not exists schedule_slots_course_idx
  on public.schedule_slots (course_id);

create index if not exists schedule_slots_teacher_idx
  on public.schedule_slots (teacher_id);

drop trigger if exists schedule_slots_set_updated_at on public.schedule_slots;
create trigger schedule_slots_set_updated_at
  before update on public.schedule_slots
  for each row execute function public.set_updated_at();

alter table public.semesters enable row level security;
alter table public.teachers enable row level security;
alter table public.courses enable row level security;
alter table public.schedule_slots enable row level security;

drop policy if exists semesters_admin_all on public.semesters;
create policy semesters_admin_all on public.semesters
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists teachers_admin_all on public.teachers;
create policy teachers_admin_all on public.teachers
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists courses_admin_all on public.courses;
create policy courses_admin_all on public.courses
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists schedule_slots_admin_all on public.schedule_slots;
create policy schedule_slots_admin_all on public.schedule_slots
  for all
  using (public.is_admin())
  with check (public.is_admin());
