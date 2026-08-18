-- 0003 — 每日瀏覽快照。
--
-- posts.view_count 是一個只增不減的累計整數，看不出「哪一天被看」。
-- 累計值對老文章天生有利，永遠回答不了「最近哪篇在紅」。這張表把
-- 每次計數同時落到當天的桶子裡，趨勢從套用這個 migration 那天開始累積。
--
-- 保留 view_count 不動：首頁／文章頁讀的是它，改成 sum() 等於讓每次
-- 讀取都掃這張表，沒必要。兩者是「總量」與「分佈」的關係，不是重複。

create table if not exists public.post_view_daily (
  post_id uuid not null references public.posts(id) on delete cascade,
  -- UTC 日界線。站是單人經營、讀者跨時區，挑哪條線都一樣武斷，
  -- 取 UTC 至少跟 timestamptz 的預設一致，不用另外記住偏移。
  day date not null default (now() at time zone 'utc')::date,
  views integer not null default 0,
  primary key (post_id, day)
);

-- 唯一的查詢型態是「最近 N 天，全部文章」，所以日期在前。
create index if not exists post_view_daily_day_idx
  on public.post_view_daily (day desc);

alter table public.post_view_daily enable row level security;

-- 只有後台看得到明細。匿名端從來不需要讀它——計數是透過底下的
-- SECURITY DEFINER 函式寫入的，RLS 對那條路徑不適用。
create policy post_view_daily_admin_all on public.post_view_daily
  for all using (is_admin()) with check (is_admin());

-- 累計與當日桶子一起寫。兩句都在同一個函式裡，同一個交易，
-- 不會出現「總數加了但當天沒記到」的偏差。
create or replace function public.increment_post_view_count(post_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  with bumped as (
    update public.posts set view_count = view_count + 1
    where id = post_id and status = 'published'
    returning id
  )
  insert into public.post_view_daily (post_id, day, views)
  select id, (now() at time zone 'utc')::date, 1 from bumped
  on conflict (post_id, day) do update
    set views = post_view_daily.views + 1;
$function$;
