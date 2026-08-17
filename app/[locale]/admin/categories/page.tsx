'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/app/lib/supabase/categories'
import { createClient } from '@/app/lib/supabase/client'
import type { Category, CreateCategoryInput } from '@/app/types/blog'
import Modal from '@/app/components/admin/Modal/Modal'
import Button from '@/app/components/admin/Button/Button'
import Input from '@/app/components/admin/Input/Input'
import Textarea from '@/app/components/admin/Textarea/Textarea'
import DataTable, {
  type DataTableColumn,
  type DataTableAction,
} from '@/app/components/admin/DataTable/DataTable'
import { useToast } from '@/app/components/admin/Toast/ToastProvider'
import { useConfirm } from '@/app/components/admin/ConfirmDialog/ConfirmDialog'
import PageHeader from '@/app/components/admin/PageHeader/PageHeader'
import style from './categories.module.scss'

/**
 * 分類管理頁面
 */
export default function CategoriesPage() {
  const t = useTranslations('AdminPage.categories')
  const toast = useToast()
  const confirm = useConfirm()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [currentLocale, setCurrentLocale] = useState<'zh-tw' | 'en'>('zh-tw')
  const supabase = useMemo(() => createClient(), [])

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
      const data = await getCategories(supabase)
      setCategories(data)
    } catch (error) {
      toast.error(t('loadError'))
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
        toast.error(t('slugRequired'))
        return
      }
      if (!formData['zh-tw'].name || !formData.en.name) {
        toast.error(t('nameRequired'))
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
        await updateCategory(supabase, editingCategory.id, input)
        toast.success(t('updateSuccess'))
      } else {
        // 新增
        await createCategory(supabase, input)
        toast.success(t('createSuccess'))
      }

      setIsModalOpen(false)
      loadCategories()
    } catch (error) {
      toast.error(t('saveError'))
    }
  }

  //* 刪除分類
  const handleDelete = async (category: Category) => {
    const ok = await confirm({
      title: t('deleteConfirmTitle'),
      message: t('deleteConfirmMessage', {
        name: category.locales['zh-tw'].name,
      }),
      danger: true,
    })
    if (!ok) return

    try {
      await deleteCategory(supabase, category.id)
      toast.success(t('deleteSuccess'))
      loadCategories()
    } catch (error: any) {
      toast.error(error.message || t('deleteError'))
    }
  }

  const categoryColumns: DataTableColumn<Category>[] = [
    {
      key: 'slug',
      header: t('table.slug'),
      render: (category) => <code className={style.slug}>{category.slug}</code>,
    },
    {
      key: 'nameZh',
      header: t('table.nameZh'),
      render: (category) => category.locales['zh-tw'].name,
    },
    {
      key: 'nameEn',
      header: t('table.nameEn'),
      render: (category) => category.locales.en.name,
    },
    {
      key: 'postCount',
      header: t('table.postCount'),
      render: (category) => category.postCount ?? t('none'),
    },
  ]

  const categoryActions: DataTableAction<Category>[] = [
    {
      label: t('edit'),
      variant: 'secondary',
      onClick: handleEdit,
    },
    {
      label: t('delete'),
      variant: 'danger',
      onClick: handleDelete,
      disabled: (category) => (category.postCount ?? 0) > 0,
    },
  ]

  return (
    <div className={style.categories_page}>
      <div className={style.container}>
        <PageHeader
          title={t('heading')}
          subtitle={
            <>
              {t('count.total')}
              {categories.length}
              {t('count.unit')}
            </>
          }
          action={<Button onClick={handleCreate}>{t('newCategory')}</Button>}
        />

        {/* 分類列表 */}
        {loading ? (
          <div className={style.loading}>{t('loading')}</div>
        ) : categories.length === 0 ? (
          <div className={style.empty}>
            <p>{t('empty')}</p>
            <Button onClick={handleCreate}>{t('createFirst')}</Button>
          </div>
        ) : (
          <DataTable
            columns={categoryColumns}
            data={categories}
            rowKey={(category) => category.id}
            actionsHeader={t('table.actions')}
            actions={categoryActions}
          />
        )}

        {/* 編輯彈窗 */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingCategory ? t('modal.editTitle') : t('modal.newTitle')}
        >
          <div className={style.form}>
            {/* Slug */}
            <Input
              label={t('modal.slugLabel')}
              value={formData.slug}
              onChange={(value) => setFormData({ ...formData, slug: value })}
              placeholder={t('modal.slugPlaceholder')}
              required
              helper={t('modal.slugHelper')}
            />

            {/* 語言切換 */}
            <div className={style.locale_tabs}>
              <button
                className={`${style.locale_tab} ${
                  currentLocale === 'zh-tw' ? style.active : ''
                }`}
                onClick={() => setCurrentLocale('zh-tw')}
              >
                {t('modal.localeZh')}
              </button>
              <button
                className={`${style.locale_tab} ${
                  currentLocale === 'en' ? style.active : ''
                }`}
                onClick={() => setCurrentLocale('en')}
              >
                {t('modal.localeEn')}
              </button>
            </div>

            {/* 語言內容 */}
            <div className={style.locale_content}>
              <Input
                label={t('modal.nameLabel')}
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
                placeholder={t('modal.namePlaceholder')}
                required
              />

              <Textarea
                label={t('modal.descriptionLabel')}
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
                placeholder={t('modal.descriptionPlaceholder')}
                rows={3}
              />
            </div>

            {/* 按鈕 */}
            <div className={style.form_actions}>
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                {t('modal.cancel')}
              </Button>
              <Button onClick={handleSave}>{t('modal.save')}</Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  )
}
