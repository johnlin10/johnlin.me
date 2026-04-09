'use client'

import { useState, useEffect } from 'react'
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/app/lib/firebase/categories'
import type { Category, CreateCategoryInput } from '@/app/types/blog'
import Modal from '@/app/components/admin/Modal/Modal'
import Button from '@/app/components/admin/Button/Button'
import Input from '@/app/components/admin/Input/Input'
import Textarea from '@/app/components/admin/Textarea/Textarea'
import style from './categories.module.scss'

/**
 * 分類管理頁面
 */
export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [currentLocale, setCurrentLocale] = useState<'zh-tw' | 'en'>('zh-tw')

  //* 表單狀態
  const [formData, setFormData] = useState({
    slug: '',
    'zh-tw': { name: '', description: '' },
    en: { name: '', description: '' },
  })

  //* 載入分類列表
  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      setLoading(true)
      const data = await getAllCategories()
      setCategories(data)
    } catch (error) {
      alert('載入分類失敗')
    } finally {
      setLoading(false)
    }
  }

  //* 開啟新增彈窗
  const handleCreate = () => {
    setEditingCategory(null)
    setFormData({
      slug: '',
      'zh-tw': { name: '', description: '' },
      en: { name: '', description: '' },
    })
    setCurrentLocale('zh-tw')
    setIsModalOpen(true)
  }

  //* 開啟編輯彈窗
  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setFormData({
      slug: category.slug,
      'zh-tw': category.locales['zh-tw'],
      en: category.locales.en,
    })
    setCurrentLocale('zh-tw')
    setIsModalOpen(true)
  }

  //* 儲存分類
  const handleSave = async () => {
    try {
      // 驗證
      if (!formData.slug) {
        alert('請輸入 Slug')
        return
      }
      if (!formData['zh-tw'].name || !formData.en.name) {
        alert('請填寫所有語言的名稱')
        return
      }

      const input: CreateCategoryInput = {
        slug: formData.slug,
        locales: {
          'zh-tw': formData['zh-tw'],
          en: formData.en,
        },
      }

      if (editingCategory) {
        // 更新
        await updateCategory(editingCategory.id, input)
        alert('更新成功')
      } else {
        // 新增
        await createCategory(input)
        alert('新增成功')
      }

      setIsModalOpen(false)
      loadCategories()
    } catch (error) {
      alert('儲存失敗')
    }
  }

  //* 刪除分類
  const handleDelete = async (category: Category) => {
    if (!confirm(`確定要刪除「${category.locales['zh-tw'].name}」嗎？`)) {
      return
    }

    try {
      await deleteCategory(category.id)
      alert('刪除成功')
      loadCategories()
    } catch (error: any) {
      alert(error.message || '刪除失敗')
    }
  }

  return (
    <div className={style.categories_page}>
      <div className={style.container}>
        {/* 標題列 */}
        <div className={style.header}>
          <div className={style.title_section}>
            <h1 className={style.title}>分類管理</h1>
            <p className={style.subtitle}>共 {categories.length} 個分類</p>
          </div>
          <Button onClick={handleCreate}>新增分類</Button>
        </div>

        {/* 分類列表 */}
        {loading ? (
          <div className={style.loading}>載入中...</div>
        ) : categories.length === 0 ? (
          <div className={style.empty}>
            <p>尚無分類</p>
            <Button onClick={handleCreate}>建立第一個分類</Button>
          </div>
        ) : (
          <div className={style.table_wrapper}>
            <table className={style.table}>
              <thead>
                <tr>
                  <th>Slug</th>
                  <th>名稱（中文）</th>
                  <th>名稱（英文）</th>
                  <th>文章數</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <code className={style.slug}>{category.slug}</code>
                    </td>
                    <td>{category.locales['zh-tw'].name}</td>
                    <td>{category.locales.en.name}</td>
                    <td>{category.postCount}</td>
                    <td>
                      <div className={style.actions}>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => handleEdit(category)}
                        >
                          編輯
                        </Button>
                        <Button
                          variant="danger"
                          size="small"
                          onClick={() => handleDelete(category)}
                          disabled={category.postCount > 0}
                        >
                          刪除
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 編輯彈窗 */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingCategory ? '編輯分類' : '新增分類'}
        >
          <div className={style.form}>
            {/* Slug */}
            <Input
              label="Slug"
              value={formData.slug}
              onChange={(value) => setFormData({ ...formData, slug: value })}
              placeholder="例如：technology"
              required
              helper="URL 友善的識別碼，建議使用英文小寫"
            />

            {/* 語言切換 */}
            <div className={style.locale_tabs}>
              <button
                className={`${style.locale_tab} ${
                  currentLocale === 'zh-tw' ? style.active : ''
                }`}
                onClick={() => setCurrentLocale('zh-tw')}
              >
                繁體中文
              </button>
              <button
                className={`${style.locale_tab} ${
                  currentLocale === 'en' ? style.active : ''
                }`}
                onClick={() => setCurrentLocale('en')}
              >
                English
              </button>
            </div>

            {/* 語言內容 */}
            <div className={style.locale_content}>
              <Input
                label="名稱"
                value={formData[currentLocale].name}
                onChange={(value) =>
                  setFormData({
                    ...formData,
                    [currentLocale]: {
                      ...formData[currentLocale],
                      name: value,
                    },
                  })
                }
                placeholder="分類名稱"
                required
              />

              <Textarea
                label="描述"
                value={formData[currentLocale].description}
                onChange={(value) =>
                  setFormData({
                    ...formData,
                    [currentLocale]: {
                      ...formData[currentLocale],
                      description: value,
                    },
                  })
                }
                placeholder="分類描述"
                rows={3}
              />
            </div>

            {/* 按鈕 */}
            <div className={style.form_actions}>
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSave}>儲存</Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  )
}

