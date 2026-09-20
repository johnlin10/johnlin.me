-- 0017_qr_style.sql — QR Code 的樣式：定位點圓角和顏色（v1.11.0）
--
-- 定位點（外圍三個大方形）跟點陣分開設圓角，單位也不一樣：點陣的 radius 是一格的
-- 邊長比例（0–0.5），定位點的 eye_radius 是整個 7 格圖形的圓角程度（0–1，1 是圓環）。
-- background 是 null 表示透明背景。

alter table public.qr_codes
  add column if not exists eye_radius real not null default 0,
  add column if not exists foreground text not null default '#000000',
  add column if not exists background text default '#ffffff';

alter table public.qr_codes
  drop constraint if exists qr_codes_eye_radius_check;
alter table public.qr_codes
  add constraint qr_codes_eye_radius_check check (eye_radius >= 0 and eye_radius <= 1);

alter table public.qr_codes
  drop constraint if exists qr_codes_foreground_check;
alter table public.qr_codes
  add constraint qr_codes_foreground_check check (foreground ~ '^#[0-9a-f]{6}$');

-- null 是透明，有值就得是同樣格式的色碼
alter table public.qr_codes
  drop constraint if exists qr_codes_background_check;
alter table public.qr_codes
  add constraint qr_codes_background_check check (background is null or background ~ '^#[0-9a-f]{6}$');
