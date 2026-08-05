'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { createClient } from '@/app/lib/supabase/client'
import { isSlugExists, isPlaceholderSlug } from '@/app/lib/supabase/posts'
import Input from '@/app/components/admin/Input/Input'
import AiButton from '@/app/components/admin/AiButton/AiButton'
import AiSuggestion from '@/app/components/admin/AiSuggestion/AiSuggestion'
import { usePostEditorState, usePostEditorActions } from '../usePostEditor'
import { useAiAssist } from '../useAiAssist'
import style from './SettingsStep.module.scss'

/**
 * 網址代稱一律手動填寫，不做中文自動轉譯——既有文章的 slug 都是人工
 * 想的語意英文，slugify 對純中文標題只會回傳空字串。
 */
export default function SlugField() {
  const t = useTranslations('AdminPage.postEditor.slugField')
  const locale = useLocale()
  const { postId, draft, createdAt, publishedAt } = usePostEditorState()
  const { setField } = usePostEditorActions()
  const { request, pending } = useAiAssist()
  const supabase = useMemo(() => createClient(), [])
  const [checking, setChecking] = useState(false)
  const [duplicateError, setDuplicateError] = useState<string | null>(null)

  const isPlaceholder = isPlaceholderSlug(draft.slug)
  const title = draft.locales['zh-tw'].title.trim()

  const handleAiSlug = () => {
    request(
      'slug',
      { title, description: draft.locales['zh-tw'].description },
      {
        current: isPlaceholder ? '' : draft.slug,
        apply: (value) => setField('slug', value),
      }
    )
  }

  useEffect(() => {
    if (!draft.slug || isPlaceholderSlug(draft.slug)) {
      setDuplicateError(null)
      setChecking(false)
      return
    }
    let cancelled = false
    setChecking(true)
    const timer = setTimeout(async () => {
      try {
        const exists = await isSlugExists(supabase, draft.slug, postId)
        if (!cancelled) setDuplicateError(exists ? t('slugTaken') : null)
      } finally {
        if (!cancelled) setChecking(false)
      }
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [draft.slug, postId, supabase])

  const formatDate = (iso: string): string =>
    new Date(iso).toLocaleDateString(locale === 'zh-tw' ? 'zh-TW' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })

  const statusLabel =
    draft.status === 'published'
      ? publishedAt
        ? t('publishedAtWithDate', { date: formatDate(publishedAt) })
        : t('publishedAtNoDate')
      : t('draftCreatedAt', { date: formatDate(createdAt) })

  return (
    <div className={style.stack}>
      <div className={style.fieldWrap}>
        <Input
          label={t('label')}
          value={draft.slug}
          onChange={(value) => setField('slug', value)}
          placeholder={t('placeholder')}
          required
          error={duplicateError ?? undefined}
          helper={
            duplicateError
              ? undefined
              : isPlaceholder
                ? t('autoSlugHelper')
                : checking
                  ? t('checking')
                  : undefined
          }
          action={
            <AiButton
              label={t('aiLabel')}
              onClick={handleAiSlug}
              pending={pending === 'slug'}
              disabled={!title}
            />
          }
        />
        <AiSuggestion task="slug" />
      </div>
      <p className={style.slugPreview}>
        johnlin.me/blog/<span>{draft.slug || '...'}</span>
      </p>
      <p className={style.statusLine}>{statusLabel}</p>
    </div>
  )
}
