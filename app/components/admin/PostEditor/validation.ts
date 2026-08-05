import { isPlaceholderSlug } from '@/app/lib/supabase/posts'
import type { PostDraft } from './postDraft'

export interface FieldError {
  field: 'title' | 'slug'
  message: string
}

export interface ValidationMessages {
  titleRequired: string
  slugRequired: string
  slugInvalid: string
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * 發表前的同步驗證。英文標題與分類刻意維持選填（符合 as-needed 雙語）。
 * 非同步的唯一性檢查（isSlugExists）由呼叫端另外處理。
 * messages 由呼叫端（元件 render 階段）透過 useTranslations 取得——
 * 這裡是純函式，不能自己呼叫 hook。
 */
export function validateForPublish(
  draft: PostDraft,
  messages: ValidationMessages
): FieldError[] {
  const errors: FieldError[] = []

  if (!draft.locales['zh-tw'].title.trim()) {
    errors.push({ field: 'title', message: messages.titleRequired })
  }

  if (!draft.slug || isPlaceholderSlug(draft.slug)) {
    errors.push({ field: 'slug', message: messages.slugRequired })
  } else if (!SLUG_PATTERN.test(draft.slug)) {
    errors.push({
      field: 'slug',
      message: messages.slugInvalid,
    })
  }

  return errors
}
