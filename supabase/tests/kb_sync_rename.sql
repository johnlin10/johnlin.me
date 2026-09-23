-- kb_sync 認出改名、代碼跟著走（0021_kb_note_codes.sql）。
-- 貼到 SQL Editor 或用 MCP 的 execute_sql 跑。最後一定丟例外，整段回滾不留資料：
-- 看到「PASS」就對了，「FAIL」後面是每一項的結果。
do $$
declare
  a_code text; b_code text; c_code text; d_code text;
  r jsonb;
begin
  perform kb_sync('測試/', '[
    {"path":"測試/A.md","content":"a","hash":"h1","links":[]},
    {"path":"測試/B.md","content":"b","hash":"h2","links":[]},
    {"path":"測試/C.md","content":"c","hash":"h3","links":[]},
    {"path":"測試/D.md","content":"c","hash":"h3","links":[]}]'::jsonb,
    array['測試/A.md', '測試/B.md', '測試/C.md', '測試/D.md']);
  insert into kb_shares (token, scope) values ('zztest', '測試/A.md');
  update kb_notes set updated_at = '2000-01-01' where starts_with(path, '測試/');
  select code into a_code from kb_notes where path = '測試/A.md';
  select code into b_code from kb_notes where path = '測試/B.md';
  select code into c_code from kb_notes where path = '測試/C.md';
  select code into d_code from kb_notes where path = '測試/D.md';

  -- A 改名搬家、B 改內容、C D 內容一樣又都改名（分不出誰是誰）
  perform kb_sync('測試/', '[
    {"path":"測試/X/A2.md","content":"a","hash":"h1","links":[]},
    {"path":"測試/B.md","content":"b2","hash":"h4","links":[]},
    {"path":"測試/C2.md","content":"c","hash":"h3","links":[]},
    {"path":"測試/D2.md","content":"c","hash":"h3","links":[]}]'::jsonb,
    array['測試/X/A2.md', '測試/B.md', '測試/C2.md', '測試/D2.md']);

  select jsonb_build_object(
    'a_code_kept', (select code = a_code from kb_notes where path = '測試/X/A2.md'),
    'a_time_kept', (select updated_at = '2000-01-01' from kb_notes where path = '測試/X/A2.md'),
    'share_moved', (select scope = '測試/X/A2.md' from kb_shares where token = 'zztest'),
    'b_code_kept', (select code = b_code from kb_notes where path = '測試/B.md'),
    'b_time_bumped', (select updated_at > '2000-01-01' from kb_notes where path = '測試/B.md'),
    'cd_new_codes', (select bool_and(code not in (c_code, d_code)) from kb_notes
                     where path in ('測試/C2.md', '測試/D2.md')),
    'four_notes', (select count(*) = 4 from kb_notes where starts_with(path, '測試/'))
  ) into r;

  if (select bool_and(value::boolean) from jsonb_each_text(r)) then
    raise exception 'PASS';
  end if;
  raise exception 'FAIL %', r;
end $$;
