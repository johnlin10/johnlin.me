-- 0022_drop_kb_note_by_path.sql — 刪掉用分享路徑讀筆記的舊函式（v1.13.4）
--
-- 0021 改用筆記代碼後，get_kb_note(token, 分享路徑) 只是留給部署前的網站用。
-- v1.13.3 已經部署，分享頁、懸停預覽和 OG 圖都改走 get_kb_shared_note(token, 代碼)。

drop function if exists public.get_kb_note(text, text);
