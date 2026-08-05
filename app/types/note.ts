//* ==================== 短文 Notes 型別 ====================

export interface NoteImage {
  url: string
  alt?: string
  w?: number
  h?: number
}

export type NoteStatus = 'draft' | 'published'

export interface Note {
  id: string
  content: string
  images: NoteImage[]
  status: NoteStatus
  createdAt: string
  publishedAt?: string
}

export interface CreateNoteInput {
  content: string
  images: NoteImage[]
  status?: NoteStatus
}

export interface UpdateNoteInput {
  id: string
  content?: string
  images?: NoteImage[]
  status?: NoteStatus
}
