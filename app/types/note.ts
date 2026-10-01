//* ==================== 短文 Notes 型別 ====================

export interface NoteImage {
  /** 短文裡顯示的小圖（R2 notes/images/<id>/display.webp） */
  url: string
  /** 原檔，燈箱裡疊在小圖上淡入；舊資料沒有時燈箱直接用 url */
  original?: string
  alt?: string
  w?: number
  h?: number
}

/** 內文第一個網址的預覽卡資料，發布時在後台抓好存進 DB。image 是轉存到 R2 notes/links/ 的 webp。 */
export interface LinkPreview {
  url: string
  title: string
  description?: string
  siteName?: string
  image?: string
}

export type NoteStatus = 'draft' | 'published'

export interface Note {
  id: string
  content: string
  images: NoteImage[]
  linkPreview: LinkPreview | null
  status: NoteStatus
  createdAt: string
  publishedAt?: string
}

export interface CreateNoteInput {
  content: string
  images: NoteImage[]
  linkPreview?: LinkPreview | null
  status?: NoteStatus
}

export interface UpdateNoteInput {
  id: string
  content?: string
  images?: NoteImage[]
  linkPreview?: LinkPreview | null
  status?: NoteStatus
}
