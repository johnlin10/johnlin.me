import type { SupabaseClient } from '@supabase/supabase-js'
import { newToken } from './tutoring'

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

export type KbShareLink = {
  token: string
  /** 筆記路徑（.md 結尾）或資料夾（/ 結尾） */
  scope: string
  label: string | null
  created_at: string
}

/**
 * 開過的分享連結，新的在前。
 * @param supabase Supabase client
 * @returns 分享連結
 */
export async function getKbShareLinks(supabase: SupabaseClient): Promise<KbShareLink[]> {
  const { data, error } = await supabase
    .from('kb_shares')
    .select('token, scope, label, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

/**
 * 開一條分享連結。
 * @param supabase Supabase client
 * @param scope 筆記路徑或資料夾
 * @param label 自己認連結用的名字
 * @returns 新的分享連結
 */
export async function createKbShareLink(
  supabase: SupabaseClient,
  scope: string,
  label: string | null,
): Promise<KbShareLink> {
  const { data, error } = await supabase
    .from('kb_shares')
    .insert({ token: newToken(), scope, label })
    .select('token, scope, label, created_at')
    .single()
  if (error) throw error
  return data
}

/**
 * 撤銷分享連結，刪掉就立刻打不開。
 * @param supabase Supabase client
 * @param token 分享 token
 */
export async function deleteKbShareLink(supabase: SupabaseClient, token: string): Promise<void> {
  const { error } = await supabase.from('kb_shares').delete().eq('token', token)
  if (error) throw error
}

/**
 * 知識資料夾：分享時連結可以一路帶出裡面的筆記。
 * @param supabase Supabase client
 * @returns 資料夾路徑，'/' 結尾
 */
export async function getKnowledgeFolders(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from('kb_knowledge_folders').select('path')
  if (error) throw error
  return data.map((row) => row.path)
}

/**
 * 設定或取消知識資料夾。
 * @param supabase Supabase client
 * @param path 資料夾路徑，'/' 結尾
 * @param on true 是設定
 */
export async function setKnowledgeFolder(
  supabase: SupabaseClient,
  path: string,
  on: boolean,
): Promise<void> {
  const { error } = on
    ? await supabase.from('kb_knowledge_folders').insert({ path })
    : await supabase.from('kb_knowledge_folders').delete().eq('path', path)
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
