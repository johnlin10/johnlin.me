-- 0016_qr_radius.sql — QR Code 的模組圓角（v1.11.0）
--
-- 0 是直角，0.5 是把每一格畫成圓點。存起來的碼下次叫出來、或直接從清單下載，
-- 都要跟當初看到的長一樣，所以圓角跟著資料走，不是介面上的暫時設定。

alter table public.qr_codes
  add column if not exists radius real not null default 0;

alter table public.qr_codes
  drop constraint if exists qr_codes_radius_check;
alter table public.qr_codes
  add constraint qr_codes_radius_check check (radius >= 0 and radius <= 0.5);
