'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { getTags } from '@/app/lib/supabase/tags'
import { createClient } from '@/app/lib/supabase/client'
import type { Tag } from '@/app/types/blog'
import style from './Selector.module.scss'

interface TagSelectorProps {
  value: string[]
  onChange: (tagIds: string[]) => void
  locale?: 'zh-tw' | 'en'
  label?: string
}

/**
 * 標籤選擇器（多選）
 */
export default function TagSelector({
  value,
  onChange,
  locale = 'zh-tw',
  label,
}: TagSelectorProps) {
  const t = useTranslations('AdminPage.selectors.tag')
  const resolvedLabel = label ?? t('label')
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    loadTags()
  }, [])

  const loadTags = async () => {
    try {
      const data = await getTags(supabase)
      setTags(data)
    } catch (error) {
      console.error('載入標籤失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = (tagId: string) => {
    if (value.includes(tagId)) {
      onChange(value.filter((id) => id !== tagId))
    } else {
      onChange([...value, tagId])
    }
  }

  if (loading) {
    return (
      <div className={style.selector_wrapper}>
        {resolvedLabel && <label className={style.label}>{resolvedLabel}</label>}
        <div className={style.loading}>{t('loading')}</div>
      </div>
    )
  }

  return (
    <div className={style.selector_wrapper}>
      {resolvedLabel && <label className={style.label}>{resolvedLabel}</label>}
      <div className={style.tag_list}>
        {tags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => handleToggle(tag.id)}
            className={`${style.tag_item} ${
              value.includes(tag.id) ? style.active : ''
            }`}
          >
            {tag.locales[locale].name}
          </button>
        ))}
      </div>
    </div>
  )
}

