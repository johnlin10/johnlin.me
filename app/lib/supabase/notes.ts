import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Note,
  NoteImage,
  NoteStatus,
  CreateNoteInput,
  UpdateNoteInput,
} from '@/app/types/note'

type NoteRow = {
  id: string
  content: string
  images: NoteImage[]
  status: NoteStatus
  created_at: string
  published_at: string | null
}

/**
 * images 是未經驗證的 jsonb，渲染端會拿 w/h 算比例、拿 url 當 next/image src。
 * 這裡把畸形資料濾掉、把 w/h 收斂成正有限數字或 undefined，避免除以非法值。
 */
function normalizeNoteImages(images: unknown): NoteImage[] {
  if (!Array.isArray(images)) return []
  const result: NoteImage[] = []
  for (const item of images) {
    if (!item || typeof item !== 'object') continue
    const { url, alt, w, h } = item as Record<string, unknown>
    if (typeof url !== 'string' || url.length === 0) continue
    const image: NoteImage = { url }
    if (typeof alt === 'string' && alt.length > 0) image.alt = alt
    if (typeof w === 'number' && Number.isFinite(w) && w > 0) image.w = w
    if (typeof h === 'number' && Number.isFinite(h) && h > 0) image.h = h
    result.push(image)
  }
  return result
}

function mapNote(row: NoteRow): Note {
  return {
    id: row.id,
    content: row.content,
    images: normalizeNoteImages(row.images),
    status: row.status,
    createdAt: row.created_at,
    publishedAt: row.published_at ?? undefined,
  }
}

//* ==================== 讀取 ====================

export async function getPublishedNotes(
  supabase: SupabaseClient,
  params: { page?: number; pageSize?: number } = {}
): Promise<{ data: Note[]; total: number; hasMore: boolean }> {
  const { page = 1, pageSize = 20 } = params
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, count, error } = await supabase
    .from('notes')
    .select('*', { count: 'exact' })
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .range(from, to)
  if (error) throw error

  const notes = (data as NoteRow[]).map(mapNote)
  const total = count ?? notes.length
  return { data: notes, total, hasMore: to + 1 < total }
}

export async function getNoteById(
  supabase: SupabaseClient,
  id: string
): Promise<Note | null> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? mapNote(data as NoteRow) : null
}

export async function getNotesForAdmin(
  supabase: SupabaseClient
): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as NoteRow[]).map(mapNote)
}

//* ==================== 寫入 ====================

export async function createNote(
  supabase: SupabaseClient,
  input: CreateNoteInput
): Promise<string> {
  const status = input.status ?? 'published'
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('notes')
    .insert({
      content: input.content,
      images: input.images,
      status,
      published_at: status === 'published' ? now : null,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function updateNote(
  supabase: SupabaseClient,
  input: UpdateNoteInput
): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (input.content !== undefined) patch.content = input.content
  if (input.images !== undefined) patch.images = input.images
  if (input.status !== undefined) {
    patch.status = input.status
    if (input.status === 'published') {
      patch.published_at = new Date().toISOString()
    } else if (input.status === 'draft') {
      patch.published_at = null
    }
  }
  if (Object.keys(patch).length === 0) return

  const { error } = await supabase.from('notes').update(patch).eq('id', input.id)
  if (error) throw error
}

export async function deleteNote(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw error
}
