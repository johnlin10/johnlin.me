-- 0018_short_link_click_cap.sql — 短網址點擊紀錄加上限
--
-- resolve_short_link 開放匿名執行，任何人拿著 anon key 直接打 Supabase 就能繞過 proxy，
-- 把 p_log 設成 true 無限寫入 short_link_clicks。這裡讓同一個 slug 每小時最多記 200 筆，
-- 超過只轉址、不再記錄。上限只擋資料量暴增，擋不了偽造：p_country、p_referrer_host
-- 仍由呼叫端決定，要防偽造只能把這支函式收回、改由伺服器端金鑰呼叫。

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
      and (
        select count(*) from public.short_link_clicks c
        where c.slug = link.slug and c.clicked_at > now() - interval '1 hour'
      ) < 200
  )
  select target_url from link;
$function$;
