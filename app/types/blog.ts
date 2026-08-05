//* ==================== 文章相關型別 ====================
//
// 時間欄位一律為 ISO 8601 字串（Supabase timestamptz 的 JSON 表示），
// 而非 Firestore Timestamp。渲染時以 new Date(...) 轉換。
// 雙語內容存於 JSONB `locales`；資料層負責 snake_case ↔ camelCase 映射。

/**
 * 文章狀態
 */
export type PostStatus = 'draft' | 'published'

/**
 * 支援的語言
 */
export type SupportedLocale = 'zh-tw' | 'en'

/**
 * 目錄項目
 */
export interface TocItem {
  level: number // 標題層級 (1-6)
  text: string // 標題文字
  id: string // 錨點 ID
}

/**
 * SEO 設定
 */
export interface SeoConfig {
  metaTitle: string
  metaDescription: string
  keywords: string[]
}

/**
 * 封面圖片
 */
export interface CoverImage {
  url: string // Supabase Storage 公開 URL
  alt: string // 圖片描述
}

/**
 * 文章多語言內容
 */
export interface PostLocaleContent {
  title: string
  description: string
  content: string // 富文本 HTML（TipTap 輸出）
  seo: SeoConfig
  toc?: TocItem[] // 自動生成的目錄
}

/**
 * 文章主要資料結構
 */
export interface Post {
  id: string
  slug: string
  status: PostStatus

  // 分類與標籤
  categoryId: string
  tagIds: string[]

  // 連載系列 (可選)
  seriesId?: string
  seriesOrder?: number

  // 封面圖
  coverImage?: CoverImage | null

  // 多語言內容
  locales: {
    [key in SupportedLocale]: PostLocaleContent
  }

  // 時間（ISO 字串）
  createdAt: string
  updatedAt: string
  publishedAt?: string

  // 擴展欄位
  viewCount?: number
}

/**
 * 建立文章的輸入資料
 */
export interface CreatePostInput {
  slug: string
  status: PostStatus
  categoryId: string
  tagIds: string[]
  seriesId?: string
  seriesOrder?: number
  coverImage?: CoverImage | null
  locales: {
    [key in SupportedLocale]: PostLocaleContent
  }
}

/**
 * 更新文章的輸入資料
 */
export interface UpdatePostInput extends Partial<CreatePostInput> {
  id: string
}

//* ==================== 分類相關型別 ====================

/**
 * 分類多語言內容
 */
export interface CategoryLocaleContent {
  name: string
  description: string
}

/**
 * 分類資料結構
 */
export interface Category {
  id: string
  slug: string
  locales: {
    [key in SupportedLocale]: CategoryLocaleContent
  }
  postCount?: number // 選填；需要時由查詢帶入，不做 denormalized 儲存
  createdAt: string
}

/**
 * 建立分類的輸入資料
 */
export interface CreateCategoryInput {
  slug: string
  locales: {
    [key in SupportedLocale]: CategoryLocaleContent
  }
}

//* ==================== 標籤相關型別 ====================

/**
 * 標籤多語言內容
 */
export interface TagLocaleContent {
  name: string
}

/**
 * 標籤資料結構
 */
export interface Tag {
  id: string
  slug: string
  locales: {
    [key in SupportedLocale]: TagLocaleContent
  }
  postCount?: number
  createdAt: string
}

/**
 * 建立標籤的輸入資料
 */
export interface CreateTagInput {
  slug: string
  locales: {
    [key in SupportedLocale]: TagLocaleContent
  }
}

//* ==================== 系列相關型別（schema 預留，UI 延後）====================

/**
 * 系列多語言內容
 */
export interface SeriesLocaleContent {
  name: string
  description: string
}

/**
 * 系列資料結構
 */
export interface Series {
  id: string
  slug: string
  locales: {
    [key in SupportedLocale]: SeriesLocaleContent
  }
  postCount?: number
  coverImage?: string
  createdAt: string
}

/**
 * 建立系列的輸入資料
 */
export interface CreateSeriesInput {
  slug: string
  locales: {
    [key in SupportedLocale]: SeriesLocaleContent
  }
  coverImage?: string
}

//* ==================== 查詢相關型別 ====================

/**
 * 分頁查詢參數
 */
export interface PaginationParams {
  page: number
  pageSize: number
}

/**
 * 文章查詢參數
 */
export interface PostQueryParams extends Partial<PaginationParams> {
  status?: PostStatus
  categoryId?: string
  tagId?: string
  seriesId?: string
  search?: string
}

/**
 * 查詢結果
 */
export interface QueryResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}
