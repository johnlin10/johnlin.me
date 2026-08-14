-- 0001_photos.sql — 攝影牆（v1.0 Beta 2）
--
-- 一張照片在 R2 上有多個物件：SDR 階梯（derivatives）、原檔、OG 圖。
-- 版面完全由 taken_at 決定（年份分欄、欄內依時間排序），所以時間欄位是骨架而非附註。

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,

  -- R2 物件（全部存絕對網址，未來換 CDN 只需改這幾欄）
  -- SDR 階梯 [{ "w": 320, "url": "…" }, …]，階數依原圖尺寸而定，不放大超過原圖
  derivatives jsonb not null default '[]'::jsonb,
  url_original text not null,   -- 原檔原樣（HDR 保 HDR），聚焦時才載
  url_og text not null,         -- 1200x630 cover，OG 用
  blur_data_url text,           -- 20px LQIP dataURL
  original_mime text not null,
  original_bytes integer not null,

  -- 原始像素尺寸，決定版面比例
  width integer not null,
  height integer not null,
  is_hdr boolean not null default false,

  -- 時間。taken_at 排序用；taken_at_local 是 EXIF 的原始無時區字串，
  -- 顯示與年份分組一律讀它 —— 存成 timestamptz 會套用上傳當下的瀏覽器時區，
  -- 跨年夜的照片會被分到錯的年份組。
  taken_at timestamptz not null,
  taken_at_local text not null,
  taken_at_precision text not null default 'day',

  -- GPS 預設 NULL：在家拍的照片會把住家座標寫進公開 API 回應。
  -- 只有管理員在後台手動勾選才寫入，且四捨五入到小數 3 位（約 110m）。
  location jsonb,
  exif jsonb,   -- { make, model, lens, fNumber, exposureTime, iso, focalLength }

  -- { "zh-tw": { caption, locationName }, "en": { … } }，沿用 posts/categories 的慣例
  locales jsonb not null default '{}'::jsonb,

  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint photos_status_check
    check (status in ('draft', 'published')),
  constraint photos_taken_at_precision_check
    check (taken_at_precision in ('day', 'month', 'year')),
  constraint photos_slug_format_check
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- 前端會拿 width/height 算比例當除數，不能是 0 或負數
  constraint photos_dimensions_check
    check (width > 0 and height > 0),
  constraint photos_original_bytes_check
    check (original_bytes > 0),
  -- 'YYYY-MM-DDTHH:MM:SS'，格式錯了年份分組會整個垮掉，在 DB 層擋住
  constraint photos_taken_at_local_format_check
    check (taken_at_local ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$')
);

-- 前台主查詢：published 依拍攝時間新到舊
create index if not exists photos_published_taken_at_idx
  on public.photos (taken_at desc)
  where status = 'published';

-- 後台清單：全部依拍攝時間新到舊
create index if not exists photos_taken_at_idx
  on public.photos (taken_at desc);

drop trigger if exists photos_set_updated_at on public.photos;
create trigger photos_set_updated_at
  before update on public.photos
  for each row execute function public.set_updated_at();

alter table public.photos enable row level security;

drop policy if exists photos_public_read on public.photos;
create policy photos_public_read on public.photos
  for select
  using (status = 'published');

drop policy if exists photos_admin_all on public.photos;
create policy photos_admin_all on public.photos
  for all
  using (public.is_admin())
  with check (public.is_admin());
