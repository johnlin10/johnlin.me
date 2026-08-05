import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tag, CreateTagInput } from '@/app/types/blog'

type TagRow = {
  id: string
  slug: string
  locales: Tag['locales']
  created_at: string
}

function mapTag(row: TagRow): Tag {
  return {
    id: row.id,
    slug: row.slug,
    locales: row.locales,
    createdAt: row.created_at,
  }
}

export async function getTags(supabase: SupabaseClient): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as TagRow[]).map(mapTag)
}

export async function getTagsByIds(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Tag[]> {
  if (!ids.length) return []
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .in('id', ids)
  if (error) throw error
  return (data as TagRow[]).map(mapTag)
}

export async function getTagById(
  supabase: SupabaseClient,
  id: string
): Promise<Tag | null> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? mapTag(data as TagRow) : null
}

export async function createTag(
  supabase: SupabaseClient,
  input: CreateTagInput
): Promise<string> {
  const { data, error } = await supabase
    .from('tags')
    .insert({ slug: input.slug, locales: input.locales })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function updateTag(
  supabase: SupabaseClient,
  id: string,
  input: CreateTagInput
): Promise<void> {
  const { error } = await supabase
    .from('tags')
    .update({ slug: input.slug, locales: input.locales })
    .eq('id', id)
  if (error) throw error
}

export async function deleteTag(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from('tags').delete().eq('id', id)
  if (error) throw error
}
