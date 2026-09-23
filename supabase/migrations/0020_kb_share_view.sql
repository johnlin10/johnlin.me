-- 0020_kb_share_view.sql — 知識庫分享範圍與分享路徑（v1.13 階段 3）
--
-- 範圍：分享範圍內的筆記，加上從它們出發、只經過知識資料夾能連到的所有筆記。
-- 路徑：訪客只拿得到分享路徑，vault 的完整路徑不離開資料庫。
-- 細節見 docs/kb-plan.md 第五、六節。

create table if not exists public.kb_knowledge_folders (
  -- '學校/資料庫/'
  path text primary key,
  constraint kb_knowledge_folders_path_check
    check (path ~ '/$' and path !~ '^/')
);

alter table public.kb_knowledge_folders enable row level security;

drop policy if exists kb_knowledge_folders_admin_all on public.kb_knowledge_folders;
create policy kb_knowledge_folders_admin_all on public.kb_knowledge_folders
  for all
  using (public.is_admin())
  with check (public.is_admin());

insert into public.kb_knowledge_folders (path) values ('學校/資料庫/')
on conflict do nothing;

create or replace function public.kb_in_scope(p_path text, p_scope text)
returns boolean
language sql
immutable
set search_path to 'public'
as $function$
  select p_path = p_scope or (right(p_scope, 1) = '/' and starts_with(p_path, p_scope));
$function$;

create or replace function public.kb_is_knowledge(p_path text)
returns boolean
language sql
stable
set search_path to 'public'
as $function$
  select exists (select 1 from kb_knowledge_folders f where starts_with(p_path, f.path));
$function$;

-- 看得到的筆記：從範圍出發沿著連結一路找，只收知識資料夾裡的。
-- union 會去掉已經收過的，連結繞圈也會停
create or replace function public.kb_share_paths(p_token text)
returns setof text
language sql
stable
set search_path to 'public'
as $function$
  with recursive reach(path) as (
    select n.path
    from kb_notes n
    join kb_shares s on s.token = p_token
    where kb_in_scope(n.path, s.scope)
    union
    select x.target
    from reach r
    join kb_notes n on n.path = r.path
    cross join unnest(n.links) as t
    cross join lateral (select kb_resolve(t) as target) x
    where kb_is_knowledge(x.target)
  )
  select path from reach;
$function$;

-- 起點：分享範圍所在資料夾的上一層。'學校/115-1/行銷管理/x.md' → '學校/115-1/'
create or replace function public.kb_share_base(p_scope text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select regexp_replace(regexp_replace(p_scope, '[^/]*$', ''), '[^/]+/$', '');
$function$;

-- 拿掉 path 跟 base 共同的上層資料夾
create or replace function public.kb_strip(p_path text, p_base text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select substr(p_path, length(prefix) + 1)
  from (select string_to_array(rtrim(p_base, '/'), '/') as segments) s,
    generate_series(0, coalesce(array_length(segments, 1), 0)) as i,
    lateral (select array_to_string(segments[1:i], '/') || repeat('/', least(i, 1)) as prefix) p
  where starts_with(p_path, prefix)
  order by length(prefix) desc
  limit 1;
$function$;

-- 看得到的筆記和它們的分享路徑（保留 .md，網址上才去掉）。
-- 兩篇轉出來一樣時，這條分享全部改用完整路徑
create or replace function public.kb_share_view(p_token text)
returns table (path text, share_path text)
language sql
stable
set search_path to 'public'
as $function$
  with v as (
    select p.path, kb_strip(p.path, kb_share_base(s.scope)) as share_path
    from kb_shares s, kb_share_paths(p_token) as p(path)
    where s.token = p_token
  )
  select v.path,
    case when (select count(distinct v2.share_path) = count(*) from v v2)
      then v.share_path else v.path end
  from v;
$function$;

revoke all on function public.kb_in_scope(text, text) from public, anon, authenticated;
revoke all on function public.kb_is_knowledge(text) from public, anon, authenticated;
revoke all on function public.kb_share_paths(text) from public, anon, authenticated;
revoke all on function public.kb_share_base(text) from public, anon, authenticated;
revoke all on function public.kb_strip(text, text) from public, anon, authenticated;
revoke all on function public.kb_share_view(text) from public, anon, authenticated;

-- 分享頁：看得到的筆記清單（不含內容），in_scope 是分享範圍內的。token 不對回 null
create or replace function public.get_kb_share(p_token text)
returns json
language sql
stable
security definer
set search_path to 'public'
as $function$
  select json_build_object(
    'notes', coalesce((
      select json_agg(json_build_object(
          'path', v.share_path,
          'updated_at', n.updated_at,
          'in_scope', kb_in_scope(n.path, s.scope))
        order by v.share_path)
      from kb_share_view(p_token) v
      join kb_notes n on n.path = v.path
    ), '[]')
  )
  from kb_shares s
  where s.token = p_token;
$function$;

-- 分享頁與懸停預覽：一篇的內容，加上它的連結對到哪篇（分享路徑）。
-- 範圍外的連結不回，頁面就顯示成一般文字。看不到這篇就回 null
drop function if exists public.get_kb_note(text, text);
create function public.get_kb_note(p_token text, p_share_path text)
returns json
language sql
stable
security definer
set search_path to 'public'
as $function$
  with v as (
    select * from kb_share_view(p_token)
  )
  select json_build_object(
    'path', v.share_path,
    'content', n.content,
    'updated_at', n.updated_at,
    'links', coalesce((
      select json_object_agg(r.target, linked.share_path)
      from (
        select distinct target, kb_resolve(target) as resolved
        from unnest(n.links) as target
      ) r
      join v linked on linked.path = r.resolved
    ), '{}')
  )
  from v
  join kb_notes n on n.path = v.path
  where v.share_path = p_share_path;
$function$;

revoke all on function public.get_kb_share(text) from public;
revoke all on function public.get_kb_note(text, text) from public;
grant execute on function public.get_kb_share(text) to anon, authenticated;
grant execute on function public.get_kb_note(text, text) to anon, authenticated;
