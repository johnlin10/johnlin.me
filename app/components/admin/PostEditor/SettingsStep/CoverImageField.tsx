'use client'

import { useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/app/lib/supabase/client'
import { uploadImage } from '@/app/lib/supabase/storage'
import { useToast } from '@/app/components/admin/Toast/ToastProvider'
import Button from '@/app/components/admin/Button/Button'
import Input from '@/app/components/admin/Input/Input'
import AiButton from '@/app/components/admin/AiButton/AiButton'
import AiSuggestion from '@/app/components/admin/AiSuggestion/AiSuggestion'
import { usePostEditorState, usePostEditorActions } from '../usePostEditor'
import { useAiAssist } from '../useAiAssist'
import style from './SettingsStep.module.scss'

export default function CoverImageField() {
  const t = useTranslations('AdminPage.postEditor.coverImageField')
  const { draft } = usePostEditorState()
  const { setField } = usePostEditorActions()
  const { request, pending } = useAiAssist()
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [urlFieldOpen, setUrlFieldOpen] = useState(false)
  const [urlDraft, setUrlDraft] = useState('')

  const handleFile = async (file: File) => {
    setUploading(true)
    try {
      const url = await uploadImage(supabase, file, 'covers')
      setField('coverImage', { url, alt: draft.coverImage?.alt ?? '' })
    } catch {
      toast.error(t('uploadError'))
    } finally {
      setUploading(false)
    }
  }

  const applyUrl = () => {
    const url = urlDraft.trim()
    if (!url) return
    setField('coverImage', { url, alt: '' })
    setUrlDraft('')
    setUrlFieldOpen(false)
  }

  const handleAiAlt = () => {
    if (!draft.coverImage) return
    request(
      'coverAlt',
      { imageUrl: draft.coverImage.url, title: draft.locales['zh-tw'].title },
      {
        current: draft.coverImage.alt,
        apply: (alt) => setField('coverImage', { url: draft.coverImage!.url, alt }),
      }
    )
  }

  return (
    <div className={style.stack}>
      {draft.coverImage ? (
        <div className={style.coverPreview}>
          <img src={draft.coverImage.url} alt={draft.coverImage.alt} />
          <div className={style.coverPreviewActions}>
            <Button
              variant="secondary"
              size="small"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? t('uploading') : t('change')}
            </Button>
            <Button
              variant="danger"
              size="small"
              onClick={() => setField('coverImage', null)}
            >
              {t('remove')}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={style.coverDropzone}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? t('uploading') : t('uploadCta')}
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className={style.hiddenFileInput}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          e.target.value = ''
        }}
      />

      {draft.coverImage && (
        <div className={style.fieldWrap}>
          <Input
            label={t('altLabel')}
            value={draft.coverImage.alt}
            onChange={(alt) =>
              setField('coverImage', { url: draft.coverImage!.url, alt })
            }
            placeholder={t('altPlaceholder')}
            action={
              <AiButton
                label={t('aiAltLabel')}
                onClick={handleAiAlt}
                pending={pending === 'coverAlt'}
              />
            }
          />
          <AiSuggestion task="coverAlt" />
        </div>
      )}

      {!draft.coverImage &&
        (urlFieldOpen ? (
          <div className={style.urlRow}>
            <input
              type="url"
              className={style.urlInput}
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder={t('urlPlaceholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  applyUrl()
                }
              }}
            />
            <Button variant="secondary" size="small" onClick={applyUrl}>
              {t('apply')}
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className={style.urlToggle}
            onClick={() => setUrlFieldOpen(true)}
          >
            {t('orPasteUrl')}
          </button>
        ))}
    </div>
  )
}
