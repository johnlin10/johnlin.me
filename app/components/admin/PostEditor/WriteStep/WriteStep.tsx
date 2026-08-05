'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Editor } from '@tiptap/react'
import { createClient } from '@/app/lib/supabase/client'
import { uploadImage } from '@/app/lib/supabase/storage'
import { htmlToPlainText } from '@/app/lib/ai/htmlToPlainText'
import { useToast } from '@/app/components/admin/Toast/ToastProvider'
import RichTextEditor from '@/app/components/admin/RichTextEditor/RichTextEditor'
import MenuBar from '@/app/components/admin/RichTextEditor/MenuBar/MenuBar'
import AiButton from '@/app/components/admin/AiButton/AiButton'
import AiSuggestion from '@/app/components/admin/AiSuggestion/AiSuggestion'
import { usePostEditorState, usePostEditorActions } from '../usePostEditor'
import { useAiAssist } from '../useAiAssist'
import { hasText } from '../postDraft'
import LocaleToggle from '../LocaleToggle/LocaleToggle'
import TitleField from '../TitleField/TitleField'
import shellStyle from '../editorShell.module.scss'
import style from './WriteStep.module.scss'

/**
 * 第一步：專注寫作。中英文切換共用同一份 UI，內文靠 key={currentLocale}
 * 強制 RichTextEditor 在切換語言時 remount——TipTap 不會理會 content prop
 * 的後續變化，不 remount 會把中文內容誤寫進英文欄位。
 */
export default function WriteStep() {
  const t = useTranslations('AdminPage.postEditor.writeStep')
  const { postId, draft, currentLocale } = usePostEditorState()
  const { setLocaleField } = usePostEditorActions()
  const { request, pending } = useAiAssist()
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  const [editor, setEditor] = useState<Editor | null>(null)
  const [subtitleOpen, setSubtitleOpen] = useState(false)

  const content = draft.locales[currentLocale]
  // WriteStep 已經因為 onChange → setLocaleField → commit 而每次打字都重繪，
  // 這裡不需要額外的 state，直接讀 storage 就會是最新值。
  const characterCount = editor?.storage.characterCount?.characters() ?? 0

  // 描述的 AI 輔助只做中文，切到英文語系時不顯示按鈕。
  const showAiDescription = currentLocale === 'zh-tw'

  const handleAiDescription = () => {
    request(
      'description',
      { content: htmlToPlainText(content.content) },
      {
        current: content.description,
        apply: (value) => {
          setSubtitleOpen(true)
          setLocaleField(currentLocale, 'description', value)
        },
      }
    )
  }

  const handleImageUpload = async (file: File) => {
    try {
      const url = await uploadImage(supabase, file, `images/${postId}`)
      editor?.chain().focus().setImage({ src: url }).run()
    } catch {
      toast.error(t('imageUploadError'))
    }
  }

  return (
    <div className={style.root}>
      <div className={style.toolbarRow}>
        <MenuBar editor={editor} onImageUpload={handleImageUpload} />
        <span className={style.charCount}>{t('characterCount', { count: characterCount })}</span>
      </div>

      <div className={shellStyle.scroll}>
        <div className={style.column}>
          <div className={style.localeRow}>
            <LocaleToggle />
          </div>

          <TitleField
            value={content.title}
            onChange={(value) => setLocaleField(currentLocale, 'title', value)}
            placeholder={t('titlePlaceholder')}
            size="title"
            autoFocus
            onEnter={() => editor?.commands.focus('start')}
          />

          <div className={style.fieldWrap}>
            <div className={style.descriptionRow}>
              {subtitleOpen || content.description ? (
                <TitleField
                  value={content.description}
                  onChange={(value) =>
                    setLocaleField(currentLocale, 'description', value)
                  }
                  placeholder={t('descriptionPlaceholder')}
                  size="subtitle"
                  onEnter={() => editor?.commands.focus('start')}
                />
              ) : (
                <button
                  type="button"
                  className={style.subtitleButton}
                  onClick={() => setSubtitleOpen(true)}
                >
                  {t('addDescription')}
                </button>
              )}
              {showAiDescription && (
                <AiButton
                  label={t('aiDescriptionLabel')}
                  onClick={handleAiDescription}
                  pending={pending === 'description'}
                  disabled={!hasText(content.content)}
                />
              )}
            </div>
            <AiSuggestion task="description" />
          </div>

          <div className={style.editorArea}>
            <RichTextEditor
              key={currentLocale}
              variant="bare"
              content={content.content}
              onChange={(html) =>
                setLocaleField(currentLocale, 'content', html)
              }
              onEditorReady={setEditor}
              onImageUpload={handleImageUpload}
              placeholder={t('contentPlaceholder')}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
