import type { SupabaseClient } from '@supabase/supabase-js'

export type KbNote = {
  path: string
  updated_at: string
}

export type KbUpload = {
  path: string
  content: string
  hash: string
  links: string[]
}

// ponytail: PostgREST 一次最多回 1000 列，筆記超過一千篇要改成分頁

/**
 * 上傳過的筆記，只有路徑和更新時間。
 * @param supabase Supabase client
 * @returns 筆記清單，照路徑排
 */
export async function getKbNotes(supabase: SupabaseClient): Promise<KbNote[]> {
  const { data, error } = await supabase.from('kb_notes').select('path, updated_at').order('path')
  if (error) throw error
  return data
}

/**
 * 某個 root 底下每篇筆記的 hash，上傳前比對用。
 * @param supabase Supabase client
 * @param root 最上層資料夾，'學校/'
 * @returns path → hash
 */
export async function getKbHashes(
  supabase: SupabaseClient,
  root: string,
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('kb_notes')
    .select('path, hash')
    .like('path', `${root}%`)
  if (error) throw error
  return new Map(data.map((row) => [row.path, row.hash]))
}

/**
 * 寫入改過的筆記，刪掉 root 底下這次沒上傳的，一個交易完成。
 * @param supabase Supabase client
 * @param root 最上層資料夾，'學校/'
 * @param notes 新增和改過的筆記
 * @param paths 這次上傳的所有路徑（沒改過的也算）
 */
export async function syncKb(
  supabase: SupabaseClient,
  root: string,
  notes: KbUpload[],
  paths: string[],
): Promise<void> {
  const { error } = await supabase.rpc('kb_sync', { p_root: root, p_notes: notes, p_paths: paths })
  if (error) throw error
}

/** 路徑都是分享路徑，不是 vault 裡的完整路徑 */
export type KbShare = {
  notes: (KbNote & { in_scope: boolean })[]
}

export type KbSharedNote = KbNote & {
  content: string
  /** 連結目標 → 分享路徑，只有看得到的 */
  links: Record<string, string>
}

/**
 * 分享連結的範圍和看得到的筆記。
 * @param supabase 公開 client
 * @param token 分享 token
 * @returns token 不對回 null
 */
export async function getKbShare(supabase: SupabaseClient, token: string): Promise<KbShare | null> {
  const { data, error } = await supabase.rpc('get_kb_share', { p_token: token })
  if (error) throw error
  return data
}

/**
 * 分享範圍內的一篇筆記。
 * @param supabase 公開 client
 * @param token 分享 token
 * @param path 分享路徑
 * @returns 看不到回 null
 */
export async function getKbSharedNote(
  supabase: SupabaseClient,
  token: string,
  path: string,
): Promise<KbSharedNote | null> {
  const { data, error } = await supabase.rpc('get_kb_note', { p_token: token, p_share_path: path })
  if (error) throw error
  return data
}
