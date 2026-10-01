-- 0024_note_link_preview.sql — 短文的網址預覽卡（v1.16.0）
--
-- 發布時在後台抓一次內文第一個網址的 OG 資料，封面圖轉存到 notes bucket，
-- 前台只讀這一欄，不在訪客瀏覽時對外發請求。
-- 形狀：{ url, title, description?, siteName?, image? }，null = 沒有卡片。

alter table public.notes add column if not exists link_preview jsonb;
