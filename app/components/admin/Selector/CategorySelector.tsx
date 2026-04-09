'use client'

import { useEffect, useState } from 'react'
import { getAllCategories } from '@/app/lib/firebase/categories'
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
  label = '分類',
  required = true,
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      const data = await getAllCategories()
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
        {label && <label className={style.label}>{label}</label>}
        <div className={style.loading}>載入中...</div>
      </div>
    )
  }

  return (
    <div className={style.selector_wrapper}>
      {label && (
        <label className={style.label}>
          {label}
          {required && <span className={style.required}>*</span>}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={style.select}
        required={required}
      >
        <option value="">請選擇分類</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.locales[locale].name}
          </option>
        ))}
      </select>
    </div>
  )
}

