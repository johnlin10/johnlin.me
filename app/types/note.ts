//* ==================== 短文 Notes 型別 ====================

export interface NoteImage {
  url: string
  alt?: string
  w?: number
  h?: number
}

/** 內文第一個網址的預覽卡資料，發布時在後台抓好存進 DB。image 是轉存到 notes bucket 後的網址。 */
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
