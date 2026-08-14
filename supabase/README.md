# Supabase schema

在此之前，這個專案的資料庫 schema 與 RLS 政策只存在 Supabase 後台，repo 裡沒有任何紀錄
（`docs/blueprint.md` 把這點列為「目前最大的單點故障風險」）。
Beta 2 要新增 `photos` 表，順勢把 schema 納入版控。

## 慣例

- 檔名 `NNNN_描述.sql`，四位數流水號，**只增不改** —— 已套用的檔案不要回頭編輯，
  要修正就再寫一個新的 migration。
- 每支 migration 都必須自己帶齊 RLS：新表預設沒有 policy，不寫就是對匿名完全擋光。
- SQL 要能重複執行不炸（`if not exists` / `drop policy if exists`），
  因為套用是手動的，難免會重跑。

## 套用方式

目前**沒有**接 Supabase CLI 的自動 migration 流程，這裡的 SQL 是事實紀錄與重建依據。
實際套用二選一：

1. Supabase Dashboard → SQL Editor，貼上執行。
2. 透過 Supabase MCP 的 `apply_migration`。

兩種方式都請保持檔案與線上狀態一致 —— 這個目錄的價值完全來自「它跟線上是同一份」。

## 尚未納入版控的既有物件

以下是 Beta 1 就存在、只活在後台的東西，之後有機會再補寫成 migration：

- 表：`posts` / `post_tags` / `categories` / `tags` / `series` / `notes` / `admin_emails`
- 函式：`is_admin()`、`increment_post_view_count(post_id)`（SECURITY DEFINER）
- Storage buckets：`blog`、`notes`
