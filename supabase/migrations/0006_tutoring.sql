-- 0006_tutoring.sql — 完善就學排課（v1.6 Beta 1）
--
-- 成員、忙碌時段、輔導時段、參與者、公開連結五張表，只有管理員讀寫。
-- 公開頁走 get_tutoring_board()，設計理由見 docs/tutoring-plan.md。

create table if not exists public.tutoring_people (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  role text not null,          -- student | teacher，老師只是「要避開的人」，不算時數
  created_at timestamptz not null default now(),
  constraint tutoring_people_name_check
    check (btrim(name) <> ''),
  constraint tutoring_people_role_check
    check (role in ('student', 'teacher'))
);

-- 每人的簡化課表：只記「這個時間忙」，不記課名學分
create table if not exists public.tutoring_busy (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.tutoring_people(id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete cascade,
  day smallint not null,       -- 1 = 週一 … 7 = 週日
  start_time time not null,
  end_time time not null,
  label text,
  created_at timestamptz not null default now(),
  constraint tutoring_busy_day_check
    check (day between 1 and 7),
  constraint tutoring_busy_range_check
    check (end_time > start_time)
);

create table if not exists public.tutoring_sessions (
  id uuid primary key default gen_random_uuid(),
  program text not null,       -- after_class | peer | contest | license
  date date not null,
  start_time time not null,
  end_time time not null,
  location text,
  -- 指導老師；老師刪掉時段留著，只是沒有老師
  teacher_id uuid references public.tutoring_people(id) on delete set null,
  note text,                   -- 只給管理員看，不進公開頁
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tutoring_sessions_program_check
    check (program in ('after_class', 'peer', 'contest', 'license')),
  -- 最少 1 小時，往上每 0.5 小時一階
  constraint tutoring_sessions_duration_check check (
    end_time > start_time
    and extract(epoch from (end_time - start_time)) >= 3600
    and mod(extract(epoch from (end_time - start_time))::int, 1800) = 0
  )
);

-- 時數按人算，所以參與者獨立一張表
create table if not exists public.tutoring_attendees (
  session_id uuid not null references public.tutoring_sessions(id) on delete cascade,
  person_id uuid not null references public.tutoring_people(id) on delete cascade,
  primary key (session_id, person_id)
);

-- 公開頁的 token，只會有一列
create table if not exists public.tutoring_share (
  id boolean primary key default true,
  token text not null unique,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint tutoring_share_single_row
    check (id)
);

create index if not exists tutoring_busy_semester_person_idx
  on public.tutoring_busy (semester_id, person_id);

create index if not exists tutoring_sessions_date_idx
  on public.tutoring_sessions (date);

create index if not exists tutoring_attendees_person_idx
  on public.tutoring_attendees (person_id);

drop trigger if exists tutoring_sessions_set_updated_at on public.tutoring_sessions;
create trigger tutoring_sessions_set_updated_at
  before update on public.tutoring_sessions
  for each row execute function public.set_updated_at();

drop trigger if exists tutoring_share_set_updated_at on public.tutoring_share;
create trigger tutoring_share_set_updated_at
  before update on public.tutoring_share
  for each row execute function public.set_updated_at();

alter table public.tutoring_people enable row level security;
alter table public.tutoring_busy enable row level security;
alter table public.tutoring_sessions enable row level security;
alter table public.tutoring_attendees enable row level security;
alter table public.tutoring_share enable row level security;

drop policy if exists tutoring_people_admin_all on public.tutoring_people;
create policy tutoring_people_admin_all on public.tutoring_people
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists tutoring_busy_admin_all on public.tutoring_busy;
create policy tutoring_busy_admin_all on public.tutoring_busy
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists tutoring_sessions_admin_all on public.tutoring_sessions;
create policy tutoring_sessions_admin_all on public.tutoring_sessions
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists tutoring_attendees_admin_all on public.tutoring_attendees;
create policy tutoring_attendees_admin_all on public.tutoring_attendees
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists tutoring_share_admin_all on public.tutoring_share;
create policy tutoring_share_admin_all on public.tutoring_share
  for all
  using (public.is_admin())
  with check (public.is_admin());
