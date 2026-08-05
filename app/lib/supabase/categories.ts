import type { SupabaseClient } from '@supabase/supabase-js'
import type { Category, CreateCategoryInput } from '@/app/types/blog'

type CategoryRow = {
  id: string
  slug: string
  locales: Category['locales']
  created_at: string
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    slug: row.slug,
    locales: row.locales,
    createdAt: row.created_at,
  }
}

export async function getCategories(
  supabase: SupabaseClient
): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as CategoryRow[]).map(mapCategory)
}

export async function getCategoryById(
  supabase: SupabaseClient,
  id: string
): Promise<Category | null> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? mapCategory(data as CategoryRow) : null
}

export async function createCategory(
  supabase: SupabaseClient,
  input: CreateCategoryInput
): Promise<string> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ slug: input.slug, locales: input.locales })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function updateCategory(
  supabase: SupabaseClient,
  id: string,
  input: CreateCategoryInput
): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .update({ slug: input.slug, locales: input.locales })
    .eq('id', id)
  if (error) throw error
}

export async function deleteCategory(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}
