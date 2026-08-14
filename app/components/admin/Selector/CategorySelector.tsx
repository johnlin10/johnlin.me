'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { getCategories } from '@/app/lib/supabase/categories'
import { createClient } from '@/app/lib/supabase/client'
import type { Category } from '@/app/types/blog'
import DropdownSelect from './DropdownSelect'
import style from './Selector.module.scss'

interface CategorySelectorProps {
  value: string
  onChange: (categoryId: string) => void
  locale?: 'zh-tw' | 'en'
  label?: string
  required?: boolean
  /** 巢狀在 Popover／卡片這類已有圓角＋padding 的容器裡時開啟，圓角縮小一階。 */
  compact?: boolean
}

/**
 * 分類選擇器
 */
export default function CategorySelector({
  value,
  onChange,
  locale = 'zh-tw',
  label,
  required = true,
  compact = false,
}: CategorySelectorProps) {
  const t = useTranslations('AdminPage.selectors.category')
  const resolvedLabel = label ?? t('label')
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      const data = await getCategories(supabase)
      setCategories(data)
    } catch (error) {
      console.error('載入分類失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={style.selector_wrapper}>
        {resolvedLabel && <label className={style.label}>{resolvedLabel}</label>}
        <div className={`${style.loading} ${compact ? style.compact : ''}`}>
          {t('loading')}
        </div>
      </div>
    )
  }

  return (
    <div className={style.selector_wrapper}>
      {resolvedLabel && (
        <label className={style.label}>
          {resolvedLabel}
          {required && <span className={style.required}>*</span>}
        </label>
      )}
      <DropdownSelect
        value={value}
        onChange={onChange}
        options={categories.map((category) => ({
          value: category.id,
          label: category.locales[locale].name,
        }))}
        placeholder={t('placeholder')}
        compact={compact}
      />
    </div>
  )
}

