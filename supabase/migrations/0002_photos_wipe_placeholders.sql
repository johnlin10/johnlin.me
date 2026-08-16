-- 0002 — 清掉 v1.0 Beta 2 開發期的 picsum.photos 佔位資料。
--
-- 這些 row 的圖檔全部指向外部網址，R2 上沒有對應物件，直接刪不會留孤兒。
-- 套用前先確認 host 沒有意外變化：
--   select distinct split_part(url_original, '/', 3) from public.photos;
-- 應該只看到 picsum.photos 與真正的照片（img.johnlin.me）。
delete from public.photos
where url_original like 'https://picsum.photos/%'
   or url_original like 'https://fastly.picsum.photos/%';
