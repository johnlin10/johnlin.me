'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { getCategories } from '@/app/lib/supabase/categories'
import { createClient } from '@/app/lib/supabase/client'
import type { Category } from '@/app/types/blog'
import style from './Selector.module.scss'

interface CategorySelectorProps {
  value: string
  onChange: (categoryId: string) => void
  locale?: 'zh-tw' | 'en'
  label?: string
  required?: boolean
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
        <div className={style.loading}>{t('loading')}</div>
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
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={style.select}
        required={required}
      >
        <option value="">{t('placeholder')}</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.locales[locale].name}
          </option>
        ))}
      </select>
    </div>
  )
}

