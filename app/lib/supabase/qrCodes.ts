import type { SupabaseClient } from '@supabase/supabase-js'
import type { QrKind, QrLevel } from '@/app/lib/qr'

export type QrCode = {
  id: string
  label: string
  kind: QrKind
  fields: Record<string, string>
  level: QrLevel
  radius: number
  eye_radius: number
  foreground: string
  /** null 是透明背景 */
  background: string | null
  created_at: string
}

export type QrCodeInput = Omit<QrCode, 'id' | 'created_at'>

const COLUMNS =
  'id, label, kind, fields, level, radius, eye_radius, foreground, background, created_at'

/**
 * 存下來的 QR Code，新到舊。
 * @param supabase Supabase client
 * @returns QR Code 清單
 */
export async function getQrCodes(supabase: SupabaseClient): Promise<QrCode[]> {
  const { data, error } = await supabase
    .from('qr_codes')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as QrCode[]
}

/**
 * 新增一個 QR Code。
 * @param supabase Supabase client
 * @param input 名稱、種類、欄位值和樣式
 */
export async function createQrCode(
  supabase: SupabaseClient,
  input: QrCodeInput,
): Promise<void> {
  const { error } = await supabase.from('qr_codes').insert(input)
  if (error) throw error
}

/**
 * 修改一個 QR Code。
 * @param supabase Supabase client
 * @param id QR Code id
 * @param input 名稱、種類、欄位值和樣式
 */
export async function updateQrCode(
  supabase: SupabaseClient,
  id: string,
  input: QrCodeInput,
): Promise<void> {
  const { error } = await supabase.from('qr_codes').update(input).eq('id', id)
  if (error) throw error
}

/**
 * 刪除一個 QR Code。
 * @param supabase Supabase client
 * @param id QR Code id
 */
export async function deleteQrCode(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('qr_codes').delete().eq('id', id)
  if (error) throw error
}
