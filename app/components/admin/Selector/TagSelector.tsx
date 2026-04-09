'use client'

import { useEffect, useState } from 'react'
import { getAllTags } from '@/app/lib/firebase/tags'
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
  label = '標籤',
}: TagSelectorProps) {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTags()
  }, [])

  const loadTags = async () => {
    try {
      const data = await getAllTags()
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
        {label && <label className={style.label}>{label}</label>}
        <div className={style.loading}>載入中...</div>
      </div>
    )
  }

  return (
    <div className={style.selector_wrapper}>
      {label && <label className={style.label}>{label}</label>}
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

