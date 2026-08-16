import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Post,
  PostStatus,
  CoverImage,
  CreatePostInput,
  UpdatePostInput,
  PostLocaleContent,
  SupportedLocale,
} from '@/app/types/blog'
import { isUniqueViolation } from './errors'

// Supabase 回傳的原始列（snake_case）。tags 透過巢狀 select 帶入。
type PostRow = {
  id: string
  slug: string
  status: PostStatus
  category_id: string | null
  series_id: string | null
  series_order: number | null
  cover_image: CoverImage | null
  locales: Post['locales']
  view_count: number
  created_at: string
  updated_at: string
  published_at: string | null
  post_tags?: { tag_id: string }[]
}

function mapPost(row: PostRow): Post {
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    categoryId: row.category_id ?? '',
    tagIds: (row.post_tags ?? []).map((t) => t.tag_id),
    seriesId: row.series_id ?? undefined,
    seriesOrder: row.series_order ?? undefined,
    coverImage: row.cover_image ?? undefined,
    locales: row.locales,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at ?? undefined,
    viewCount: row.view_count,
  }
}

const POST_SELECT = '*, post_tags(tag_id)'

//* ==================== 讀取（公開）====================

/**
 * 已發布文章列表（RLS 保證匿名只讀 published）。
 */
export async function getPublishedPosts(
  supabase: SupabaseClient,
  params: { page?: number; pageSize?: number; categoryId?: string } = {}
): Promise<{ data: Post[]; total: number; hasMore: boolean }> {
  const { page = 1, pageSize = 20, categoryId } = params
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('posts')
    .select(POST_SELECT, { count: 'exact' })
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .range(from, to)

  if (categoryId) query = query.eq('category_id', categoryId)

  const { data, count, error } = await query
  if (error) throw error

  const posts = (data as PostRow[]).map(mapPost)
  const total = count ?? posts.length
  return { data: posts, total, hasMore: to + 1 < total }
}

/**
 * 最新 N 篇已發布文章（首頁用）。省去 post_tags join，輕量。
 */
export async function getLatestPosts(
  supabase: SupabaseClient,
  limit = 3
): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data as PostRow[]).map(mapPost)
}

/**
 * 依標籤取得已發布文章（inner join 過濾）。
 */
export async function getPublishedPostsByTag(
  supabase: SupabaseClient,
  tagId: string,
  params: { page?: number; pageSize?: number } = {}
): Promise<{ data: Post[]; total: number; hasMore: boolean }> {
  const { page = 1, pageSize = 20 } = params
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, count, error } = await supabase
    .from('posts')
    .select('*, post_tags!inner(tag_id)', { count: 'exact' })
    .eq('status', 'published')
    .eq('post_tags.tag_id', tagId)
    .order('published_at', { ascending: false })
    .range(from, to)
  if (error) throw error

  const posts = (data as PostRow[]).map(mapPost)
  const total = count ?? posts.length
  return { data: posts, total, hasMore: to + 1 < total }
}

/**
 * 依 slug 取得單篇文章。匿名 → 只回已發布；帶 admin session → 也能取草稿。
 */
export async function getPostBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data ? mapPost(data as PostRow) : null
}

//* ==================== 讀取（後台）====================

/**
 * 後台文章列表（admin session 下 RLS 放行全部狀態）。
 */
export async function getPostsForAdmin(
  supabase: SupabaseClient,
  params: { status?: PostStatus } = {}
): Promise<Post[]> {
  let query = supabase
    .from('posts')
    .select(POST_SELECT)
    .order('created_at', { ascending: false })

  if (params.status) query = query.eq('status', params.status)

  const { data, error } = await query
  if (error) throw error
  return (data as PostRow[]).map(mapPost)
}

/**
 * 依 id 取得文章（後台編輯用）。
 */
export async function getPostById(
  supabase: SupabaseClient,
  id: string
): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? mapPost(data as PostRow) : null
}

/**
 * 檢查 slug 是否已存在（editId 為編輯時排除自身）。
 */
export async function isSlugExists(
  supabase: SupabaseClient,
  slug: string,
  excludeId?: string
): Promise<boolean> {
  let query = supabase.from('posts').select('id').eq('slug', slug).limit(1)
  if (excludeId) query = query.neq('id', excludeId)
  const { data, error } = await query
  if (error) throw error
  return (data?.length ?? 0) > 0
}

//* ==================== 草稿建立（Substack 式分步編輯流程）====================

/**
 * 空白的雙語內容骨架。draft 建立時務必用這個，不能是 `{}`——
 * `posts/page.tsx` 等處會直接讀 `post.locales['zh-tw'].title`，骨架不完整會爆錯。
 */
export function emptyPostLocales(): Record<SupportedLocale, PostLocaleContent> {
  const empty = (): PostLocaleContent => ({
    title: '',
    description: '',
    content: '',
    seo: { metaTitle: '', metaDescription: '', keywords: [] },
  })
  return { 'zh-tw': empty(), en: empty() }
}

/**
 * 產生一個唯一的臨時 slug（新草稿在還沒有標題前，用來滿足 NOT NULL + UNIQUE）。
 * 刻意不做中文轉譯——slugify 對純中文標題會回傳空字串，且既有文章的 slug
 * 都是人工想的語意英文，不是機器翻譯得出來的。
 */
export function makePlaceholderSlug(): string {
  return `untitled-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function isPlaceholderSlug(slug: string): boolean {
  return /^untitled-[a-z0-9]+-[a-z0-9]{4}$/.test(slug)
}

// 實作已搬到 errors.ts（photos 的上傳流程也要判 23505）。這裡續留出口，
// 讓既有的 `from '@/app/lib/supabase/posts'` 呼叫點不必改。
export { isUniqueViolation }

/**
 * 建立一篇空白草稿並回傳 id。用於「新增文章」進入即建草稿的流程。
 * 臨時 slug 撞號機率極低，重試僅為保險，真正的唯一性由 DB UNIQUE constraint 保證。
 */
export async function createDraftPost(supabase: SupabaseClient): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await createPost(supabase, {
        slug: makePlaceholderSlug(),
        status: 'draft',
        categoryId: '',
        tagIds: [],
        locales: emptyPostLocales(),
      })
    } catch (error) {
      if (isUniqueViolation(error) && attempt < 2) continue
      throw error
    }
  }
  throw new Error('無法建立草稿')
}

//* ==================== 寫入 ====================

/**
 * 建立文章。published_at 由 DB trigger 於首次發布時自動蓋章。
 */
export async function createPost(
  supabase: SupabaseClient,
  input: CreatePostInput
): Promise<string> {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      slug: input.slug,
      status: input.status,
      category_id: input.categoryId || null,
      series_id: input.seriesId || null,
      series_order: input.seriesOrder ?? null,
      cover_image: input.coverImage ?? null,
      locales: input.locales,
    })
    .select('id')
    .single()
  if (error) throw error

  const id = data.id as string
  if (input.tagIds?.length) {
    const { error: tagErr } = await supabase
      .from('post_tags')
      .insert(input.tagIds.map((tag_id) => ({ post_id: id, tag_id })))
    if (tagErr) throw tagErr
  }
  return id
}

/**
 * 更新文章。有提供 tagIds 時整批重建關聯。
 */
export async function updatePost(
  supabase: SupabaseClient,
  input: UpdatePostInput
): Promise<void> {
  const { id, tagIds } = input
  const patch: Record<string, unknown> = {}
  if (input.slug !== undefined) patch.slug = input.slug
  if (input.status !== undefined) patch.status = input.status
  if (input.categoryId !== undefined) patch.category_id = input.categoryId || null
  if (input.seriesId !== undefined) patch.series_id = input.seriesId || null
  if (input.seriesOrder !== undefined) patch.series_order = input.seriesOrder ?? null
  if (input.coverImage !== undefined) patch.cover_image = input.coverImage ?? null
  if (input.locales !== undefined) patch.locales = input.locales

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from('posts').update(patch).eq('id', id)
    if (error) throw error
  }

  if (tagIds !== undefined) {
    const { error: delErr } = await supabase
      .from('post_tags')
      .delete()
      .eq('post_id', id)
    if (delErr) throw delErr
    if (tagIds.length) {
      const { error: insErr } = await supabase
        .from('post_tags')
        .insert(tagIds.map((tag_id) => ({ post_id: id, tag_id })))
      if (insErr) throw insErr
    }
  }
}

/**
 * 刪除文章（post_tags 由 FK cascade 自動清除）。
 */
export async function deletePost(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', id)
  if (error) throw error
}

/**
 * 瀏覽數 +1（透過 SECURITY DEFINER RPC，匿名可對已發布文章計數）。
 */
export async function incrementViewCount(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.rpc('increment_post_view_count', {
    post_id: id,
  })
  if (error) console.error('瀏覽數更新失敗:', error.message)
}
