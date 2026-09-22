-- 0019_kb.sql — 知識庫（v1.13.0）
--
-- 筆記在 Obsidian 寫，整個資料夾上傳過來，網站只負責顯示和分享。
-- 資料夾不另外存，從 path 推出來。分享的範圍是指定的筆記或資料夾，
-- 加上它們直接連到的筆記（只往外一層），細節見 docs/kb-plan.md。

create table if not exists public.kb_notes (
  -- 相對 vault 根目錄：'學校/115-1/行銷管理/行銷的定義.md'
  path text primary key,
  content text not null,
  -- 內容的 sha-256，上傳時只送改過的
  hash text not null,
  -- [[連結]] 的目標，去掉別名和 #標題，上傳時由 app/lib/kb.ts 解析
  links text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint kb_notes_path_check
    check (path ~ '\.md$' and path !~ '^/' and path !~ '(^|/)\.')
);

create table if not exists public.kb_shares (
  token text primary key,
  -- 筆記路徑（.md 結尾）或資料夾（/ 結尾）
  scope text not null,
  label text,
  created_at timestamptz not null default now(),
  constraint kb_shares_scope_check
    check (scope ~ '(\.md|/)$')
);

alter table public.kb_notes enable row level security;
alter table public.kb_shares enable row level security;

drop policy if exists kb_notes_admin_all on public.kb_notes;
create policy kb_notes_admin_all on public.kb_notes
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists kb_shares_admin_all on public.kb_shares;
create policy kb_shares_admin_all on public.kb_shares
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- 上傳：寫入改過的、刪掉 root 底下這次沒出現的，一個交易完成。
-- security invoker，權限交給 RLS。
create or replace function public.kb_sync(p_root text, p_notes jsonb, p_paths text[])
returns void
language plpgsql
set search_path to 'public'
as $function$
begin
  -- 空資料夾上傳會把整個 root 刪光，當成誤操作擋掉
  if p_root !~ '^[^/.][^/]*/$' or coalesce(cardinality(p_paths), 0) = 0 then
    raise exception 'kb_sync: invalid root or empty upload';
  end if;

  insert into kb_notes (path, content, hash, links)
  select n.path, n.content, n.hash, n.links
  from jsonb_to_recordset(p_notes) as n(path text, content text, hash text, links text[])
  on conflict (path) do update
    set content = excluded.content,
        hash = excluded.hash,
        links = excluded.links,
        updated_at = now();

  delete from kb_notes
  where starts_with(path, p_root) and not (path = any(p_paths));
end;
$function$;

revoke all on function public.kb_sync(text, jsonb, text[]) from public, anon;
grant execute on function public.kb_sync(text, jsonb, text[]) to authenticated;

-- [[目標]] 對到哪篇：'名稱' 比對檔名，'資料夾/名稱' 比對路徑結尾；
-- 同名就選路徑最短的，跟 Obsidian 一樣
create or replace function public.kb_resolve(p_target text)
returns text
language sql
stable
set search_path to 'public'
as $function$
  select path from kb_notes
  where path = p_target || '.md'
     or right(path, length(p_target) + 4) = '/' || p_target || '.md'
  order by length(path), path
  limit 1;
$function$;

-- 這個 token 看得到哪些筆記：範圍內的，加上它們直接連到的
create or replace function public.kb_share_paths(p_token text)
returns setof text
language sql
stable
set search_path to 'public'
as $function$
  with base as (
    select n.path, n.links
    from kb_notes n
    join kb_shares s on s.token = p_token
    where n.path = s.scope
       or (right(s.scope, 1) = '/' and starts_with(n.path, s.scope))
  )
  select path from base
  union
  select kb_resolve(target)
  from base, unnest(base.links) as target
  where kb_resolve(target) is not null;
$function$;

revoke all on function public.kb_resolve(text) from public, anon, authenticated;
revoke all on function public.kb_share_paths(text) from public, anon, authenticated;

-- 分享頁：範圍和看得到的筆記清單（不含內容）。token 不對回 null
create or replace function public.get_kb_share(p_token text)
returns json
language sql
stable
security definer
set search_path to 'public'
as $function$
  select json_build_object(
    'scope', s.scope,
    'notes', coalesce((
      select json_agg(json_build_object('path', n.path, 'updated_at', n.updated_at)
        order by n.path)
      from kb_notes n
      where n.path in (select kb_share_paths(p_token))
    ), '[]')
  )
  from kb_shares s
  where s.token = p_token;
$function$;

-- 分享頁與懸停預覽：一篇的內容，加上它的連結對到哪篇。
-- 範圍外的連結不回，頁面就顯示成一般文字。看不到這篇就回 null
create or replace function public.get_kb_note(p_token text, p_path text)
returns json
language sql
stable
security definer
set search_path to 'public'
as $function$
  with visible as (
    select kb_share_paths(p_token) as path
  )
  select json_build_object(
    'path', n.path,
    'content', n.content,
    'updated_at', n.updated_at,
    'links', coalesce((
      select json_object_agg(target, resolved)
      from (
        select distinct target, kb_resolve(target) as resolved
        from unnest(n.links) as target
      ) r
      where r.resolved in (select path from visible)
    ), '{}')
  )
  from kb_notes n
  where n.path = p_path and n.path in (select path from visible);
$function$;

revoke all on function public.get_kb_share(text) from public;
revoke all on function public.get_kb_note(text, text) from public;
grant execute on function public.get_kb_share(text) to anon, authenticated;
grant execute on function public.get_kb_note(text, text) to anon, authenticated;
