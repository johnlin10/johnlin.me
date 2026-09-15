-- 0005_short_links.sql — 短網址（v1.5 Beta 3）
--
-- 轉址在 go.johnlin.me，由 proxy 呼叫 resolve_short_link。兩張表只有管理員讀寫；
-- 訪客唯一的入口是那支函式，只能拿完整的 slug 查一筆，列不出清單。

create table if not exists public.short_links (
  slug text primary key,
  target_url text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint short_links_slug_format_check
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 64),
  -- proxy 的 matcher 會跳過開頭是 api、auth、trpc 的路徑，這種 slug 到不了轉址
  constraint short_links_slug_reserved_check
    check (slug !~ '^(api|auth|trpc)'),
  constraint short_links_target_url_check
    check (target_url ~ '^https?://')
);

create table if not exists public.short_link_clicks (
  id bigint generated always as identity primary key,
  slug text not null references public.short_links(slug) on delete cascade,
  clicked_at timestamptz not null default now(),
  referrer_host text,
  country text
);

create index if not exists short_link_clicks_slug_clicked_at_idx
  on public.short_link_clicks (slug, clicked_at desc);

drop trigger if exists short_links_set_updated_at on public.short_links;
create trigger short_links_set_updated_at
  before update on public.short_links
  for each row execute function public.set_updated_at();

alter table public.short_links enable row level security;
alter table public.short_link_clicks enable row level security;

drop policy if exists short_links_admin_all on public.short_links;
create policy short_links_admin_all on public.short_links
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists short_link_clicks_admin_all on public.short_link_clicks;
create policy short_link_clicks_admin_all on public.short_link_clicks
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- 查目標和記點擊在同一個交易；logged 沒被主查詢用到也一定會執行
create or replace function public.resolve_short_link(
  p_slug text,
  p_referrer_host text,
  p_country text,
  p_log boolean
)
returns text
language sql
volatile
security definer
set search_path to 'public'
as $function$
  with link as (
    select slug, target_url from public.short_links where slug = p_slug
  ), logged as (
    insert into public.short_link_clicks (slug, referrer_host, country)
    select slug, left(p_referrer_host, 255), left(p_country, 2)
    from link
    where p_log
  )
  select target_url from link;
$function$;
