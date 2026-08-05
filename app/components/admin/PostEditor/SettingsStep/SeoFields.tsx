'use client'

import { useTranslations } from 'next-intl'
import Input from '@/app/components/admin/Input/Input'
import Textarea from '@/app/components/admin/Textarea/Textarea'
import AiButton from '@/app/components/admin/AiButton/AiButton'
import AiSuggestion from '@/app/components/admin/AiSuggestion/AiSuggestion'
import { usePostEditorState, usePostEditorActions } from '../usePostEditor'
import { useAiAssist } from '../useAiAssist'
import style from './SettingsStep.module.scss'

export default function SeoFields() {
  const t = useTranslations('AdminPage.postEditor.seoFields')
  const { draft, currentLocale } = usePostEditorState()
  const { setSeoField } = usePostEditorActions()
  const { request, pending } = useAiAssist()
  const content = draft.locales[currentLocale]
  const seo = content.seo
  // 關鍵字 AI 輔助只做中文：其他語系不顯示按鈕。
  const zhTitle = draft.locales['zh-tw'].title.trim()

  const handleAiKeywords = () => {
    request(
      'keywords',
      { title: zhTitle, description: draft.locales['zh-tw'].description },
      { current: seo.keywords, apply: (keywords) => setSeoField(currentLocale, 'keywords', keywords) }
    )
  }

  return (
    <>
      <Input
        label={t('titleLabel')}
        value={seo.metaTitle}
        onChange={(value) => setSeoField(currentLocale, 'metaTitle', value)}
        placeholder={
          content.title
            ? t('titlePlaceholderWithFallback', { title: content.title })
            : t('titlePlaceholderNoFallback')
        }
        helper={t('titleHelper', { count: seo.metaTitle.length })}
      />

      <Textarea
        label={t('descriptionLabel')}
        value={seo.metaDescription}
        onChange={(value) =>
          setSeoField(currentLocale, 'metaDescription', value)
        }
        placeholder={
          content.description
            ? t('descriptionPlaceholderWithFallback', { description: content.description })
            : t('descriptionPlaceholderNoFallback')
        }
        rows={2}
        helper={t('descriptionHelper', { count: seo.metaDescription.length })}
      />

      <div className={style.fieldWrap}>
        <Input
          label={t('keywordsLabel')}
          value={seo.keywords.join(', ')}
          onChange={(value) =>
            setSeoField(
              currentLocale,
              'keywords',
              value
                .split(',')
                .map((k) => k.trim())
                .filter(Boolean)
            )
          }
          placeholder={t('keywordsPlaceholder')}
          helper={t('keywordsHelper')}
          action={
            currentLocale === 'zh-tw' ? (
              <AiButton
                label={t('aiKeywordsLabel')}
                onClick={handleAiKeywords}
                pending={pending === 'keywords'}
                disabled={!zhTitle}
              />
            ) : undefined
          }
        />
        <AiSuggestion task="keywords" />
      </div>
    </>
  )
}
