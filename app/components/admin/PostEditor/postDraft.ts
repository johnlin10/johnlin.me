import type { SupabaseClient } from '@supabase/supabase-js'
import { uploadAndReplaceImagesInHtml } from '@/app/lib/supabase/storage'
import { emptyPostLocales, isPlaceholderSlug } from '@/app/lib/supabase/posts'
import type {
  CoverImage,
  CreatePostInput,
  Post,
  PostLocaleContent,
  PostStatus,
  SupportedLocale,
} from '@/app/types/blog'

/**
 * 編輯器內部的表單狀態。跟 Post 的差異：
 * - categoryId / seriesId 一律是字串（空字串代表未選），不是 optional
 * - coverImage 收成單一 nullable 物件，不拆成兩個散落字串
 */
export interface PostDraft {
  slug: string
  status: PostStatus
  categoryId: string
  tagIds: string[]
  seriesId: string
  seriesOrder: number
  coverImage: CoverImage | null
  locales: Record<SupportedLocale, PostLocaleContent>
}

/** 可以透過 setField() 直接自動儲存的欄位。status／locales 各自有專屬的更新路徑。 */
export type AutosaveableField = Exclude<keyof PostDraft, 'status' | 'locales'>

function mergeLocaleContent(
  base: PostLocaleContent,
  override?: Partial<PostLocaleContent> | null
): PostLocaleContent {
  return {
    ...base,
    ...override,
    seo: { ...base.seo, ...(override?.seo ?? {}) },
  }
}

/**
 * 從資料庫讀到的 Post 建立表單狀態。對 locales 做防禦性合併——
 * 理論上 createDraftPost 一律寫完整骨架，但舊資料或手動改過的列可能不完整。
 */
export function fromPost(post: Post): PostDraft {
  const empty = emptyPostLocales()
  return {
    slug: post.slug,
    status: post.status,
    categoryId: post.categoryId || '',
    tagIds: post.tagIds || [],
    seriesId: post.seriesId || '',
    seriesOrder: post.seriesOrder || 1,
    coverImage: post.coverImage ?? null,
    locales: {
      'zh-tw': mergeLocaleContent(empty['zh-tw'], post.locales?.['zh-tw']),
      en: mergeLocaleContent(empty.en, post.locales?.en),
    },
  }
}

/** 把表單狀態組成寫入用的完整輸入（發表／儲存草稿／更新時使用，一律送出完整快照）。 */
export function toCreateInput(draft: PostDraft): CreatePostInput {
  return {
    slug: draft.slug,
    status: draft.status,
    categoryId: draft.categoryId,
    tagIds: draft.tagIds,
    seriesId: draft.seriesId || undefined,
    seriesOrder: draft.seriesId ? draft.seriesOrder : undefined,
    coverImage: draft.coverImage,
    locales: draft.locales,
  }
}

/** 去標籤後是否還有非空白文字——TipTap 空文件會吐 `<p></p>`，不能只看字串長度。 */
export function hasText(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').trim().length > 0
}

/** 判斷這篇草稿是否完全沒動過（用於離開時自動刪除孤兒草稿）。 */
export function isPristineDraft(draft: PostDraft): boolean {
  return (
    draft.status === 'draft' &&
    isPlaceholderSlug(draft.slug) &&
    !draft.locales['zh-tw'].title.trim() &&
    !draft.locales.en.title.trim() &&
    !hasText(draft.locales['zh-tw'].content) &&
    !hasText(draft.locales.en.content) &&
    !draft.coverImage &&
    !draft.categoryId &&
    draft.tagIds.length === 0
  )
}

/**
 * 把兩個語言內文裡殘留的 base64 圖片（例如貼上 Notion/Word 的 HTML 片段）
 * 上傳成 Storage URL 並替換掉。回傳全新物件，不修改傳入的 locales。
 */
export async function sweepBase64(
  supabase: SupabaseClient,
  locales: Record<SupportedLocale, PostLocaleContent>,
  postId: string
): Promise<Record<SupportedLocale, PostLocaleContent>> {
  const folder = `images/${postId}`
  const [zhContent, enContent] = await Promise.all([
    uploadAndReplaceImagesInHtml(supabase, locales['zh-tw'].content, folder),
    uploadAndReplaceImagesInHtml(supabase, locales.en.content, folder),
  ])
  return {
    'zh-tw': { ...locales['zh-tw'], content: zhContent },
    en: { ...locales.en, content: enContent },
  }
}
