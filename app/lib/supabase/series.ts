import type { SupabaseClient } from '@supabase/supabase-js'
import type { Series, CreateSeriesInput } from '@/app/types/blog'

// 系列：schema 已就緒，CMS 沿用；公開頁 UI 暫緩。
type SeriesRow = {
  id: string
  slug: string
  locales: Series['locales']
  cover_image: string | null
  created_at: string
}

function mapSeries(row: SeriesRow): Series {
  return {
    id: row.id,
    slug: row.slug,
    locales: row.locales,
    coverImage: row.cover_image ?? undefined,
    createdAt: row.created_at,
  }
}

export async function getSeries(supabase: SupabaseClient): Promise<Series[]> {
  const { data, error } = await supabase
    .from('series')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as SeriesRow[]).map(mapSeries)
}

export async function getSeriesById(
  supabase: SupabaseClient,
  id: string
): Promise<Series | null> {
  const { data, error } = await supabase
    .from('series')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? mapSeries(data as SeriesRow) : null
}

export async function createSeries(
  supabase: SupabaseClient,
  input: CreateSeriesInput
): Promise<string> {
  const { data, error } = await supabase
    .from('series')
    .insert({
      slug: input.slug,
      locales: input.locales,
      cover_image: input.coverImage ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function updateSeries(
  supabase: SupabaseClient,
  id: string,
  input: CreateSeriesInput
): Promise<void> {
  const { error } = await supabase
    .from('series')
    .update({
      slug: input.slug,
      locales: input.locales,
      cover_image: input.coverImage ?? null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteSeries(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from('series').delete().eq('id', id)
  if (error) throw error
}
