-- 0015_qr_codes.sql — QR Code 產生器（v1.11）
--
-- QR Code 裡只有一串文字，能掃出什麼全看那串文字的格式（WIFI:、BEGIN:VCARD、mailto: …）。
-- 這裡存的是表單欄位本身，不是編碼後的字串，這樣存下來的還能再叫回表單裡改；
-- 要編碼的字串由前端的 buildPayload() 現算（app/lib/qr.ts）。
-- 跟其他工具的表一樣只有管理員讀寫，訪客完全碰不到。

create table if not exists public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  kind text not null,
  -- 欄位名不能叫 values，那是 SQL 保留字
  fields jsonb not null default '{}'::jsonb,
  level text not null default 'M',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qr_codes_label_check check (length(label) between 1 and 120),
  constraint qr_codes_kind_check
    check (kind in ('url', 'text', 'wifi', 'vcard', 'email', 'sms', 'tel', 'geo')),
  constraint qr_codes_level_check check (level in ('L', 'M', 'Q', 'H')),
  -- 欄位值是一層的 key-value，別讓奇怪的結構存進來
  constraint qr_codes_fields_check check (jsonb_typeof(fields) = 'object')
);

create index if not exists qr_codes_created_at_idx on public.qr_codes (created_at desc);

drop trigger if exists qr_codes_set_updated_at on public.qr_codes;
create trigger qr_codes_set_updated_at
  before update on public.qr_codes
  for each row execute function public.set_updated_at();

alter table public.qr_codes enable row level security;

drop policy if exists qr_codes_admin_all on public.qr_codes;
create policy qr_codes_admin_all on public.qr_codes
  for all
  using (public.is_admin())
  with check (public.is_admin());
