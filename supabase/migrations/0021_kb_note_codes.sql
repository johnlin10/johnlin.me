-- 0021_kb_note_codes.sql — 知識庫筆記代碼（v1.13.3）
--
-- 分享頁網址改成 /kb/{token}/{代碼}，不再放中文路徑：LINE 碰到「、」這類全形標點就把網址切斷，
-- 編碼成 %XX 又太長。代碼上傳時自動產生，改內容不變；改名或搬家時內容沒動就跟著走。
-- 代碼不是鑰匙，看不看得到還是由 token 和分享範圍決定。細節見 docs/kb-plan.md 第六節。

-- 6 碼英文小寫加數字，約 21 億種
-- ponytail: 撞到既有代碼時那次上傳會失敗、重傳就好；筆記上萬篇再改成重試
create or replace function public.kb_new_code()
returns text
language sql
volatile
set search_path to 'public'
as $function$
  select string_agg(substr('abcdefghijklmnopqrstuvwxyz0123456789', floor(random() * 36)::int + 1, 1), '')
  from generate_series(1, 6);
$function$;

revoke all on function public.kb_new_code() from public, anon;
-- 欄位預設值會呼叫它，上傳（kb_sync，security invoker）要能執行
grant execute on function public.kb_new_code() to authenticated;

alter table public.kb_notes
  add column if not exists code text not null default public.kb_new_code();

alter table public.kb_notes
  drop constraint if exists kb_notes_code_key,
  add constraint kb_notes_code_key unique (code),
  drop constraint if exists kb_notes_code_check,
  add constraint kb_notes_code_check check (code ~ '^[a-z0-9]{6}$');

-- 上傳：先認出改名或搬家（這次消失的和新出現的內容一樣，兩邊都只有一篇），
-- 把舊的那列改成新路徑，代碼跟著走，只分享這一篇的連結也跟著搬。
-- 內容沒變就不動更新時間，改名不算更新
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

  with gone as (
    select path, hash from kb_notes
    where starts_with(path, p_root) and not (path = any(p_paths))
  ), added as (
    select n.path, n.hash
    from jsonb_to_recordset(p_notes) as n(path text, hash text)
    where not exists (select 1 from kb_notes k where k.path = n.path)
  ), moves as (
    select g.path as old_path, a.path as new_path
    from gone g
    join added a on a.hash = g.hash
    where (select count(*) from gone g2 where g2.hash = g.hash) = 1
      and (select count(*) from added a2 where a2.hash = a.hash) = 1
  ), moved as (
    update kb_notes k set path = m.new_path
    from moves m
    where k.path = m.old_path
    returning m.old_path, m.new_path
  )
  update kb_shares s set scope = moved.new_path
  from moved
  where s.scope = moved.old_path;

  insert into kb_notes (path, content, hash, links)
  select n.path, n.content, n.hash, n.links
  from jsonb_to_recordset(p_notes) as n(path text, content text, hash text, links text[])
  on conflict (path) do update
    set content = excluded.content,
        hash = excluded.hash,
        links = excluded.links,
        updated_at = case when kb_notes.hash = excluded.hash then kb_notes.updated_at else now() end;

  delete from kb_notes
  where starts_with(path, p_root) and not (path = any(p_paths));
end;
$function$;

-- 分享頁：看得到的筆記清單（不含內容），多了代碼。path 是分享路徑，目錄用
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
          'code', n.code,
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

-- 分享頁、懸停預覽和 OG 圖：用代碼讀一篇，連結對到的也是代碼。看不到這篇就回 null。
-- 舊的 get_kb_note(token, 分享路徑) 先留著，部署前的網站還在用，下一支 migration 刪掉
create or replace function public.get_kb_shared_note(p_token text, p_code text)
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
    'code', n.code,
    'content', n.content,
    'updated_at', n.updated_at,
    'links', coalesce((
      select json_object_agg(r.target, ln.code)
      from (
        select distinct target, kb_resolve(target) as resolved
        from unnest(n.links) as target
      ) r
      join v linked on linked.path = r.resolved
      join kb_notes ln on ln.path = linked.path
    ), '{}')
  )
  from v
  join kb_notes n on n.path = v.path
  where n.code = p_code;
$function$;

revoke all on function public.get_kb_shared_note(text, text) from public;
grant execute on function public.get_kb_shared_note(text, text) to anon, authenticated;
