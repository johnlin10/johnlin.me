'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  getTags,
  createTag,
  updateTag,
  deleteTag,
} from '@/app/lib/supabase/tags'
import { createClient } from '@/app/lib/supabase/client'
import type { Tag, CreateTagInput } from '@/app/types/blog'
import Modal from '@/app/components/admin/Modal/Modal'
import Button from '@/app/components/admin/Button/Button'
import Input from '@/app/components/admin/Input/Input'
import { useToast } from '@/app/components/admin/Toast/ToastProvider'
import { useConfirm } from '@/app/components/admin/ConfirmDialog/ConfirmDialog'
import style from './tags.module.scss'

/**
 * 標籤管理頁面
 */
export default function TagsPage() {
  const t = useTranslations('AdminPage.tags')
  const toast = useToast()
  const confirm = useConfirm()
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [currentLocale, setCurrentLocale] = useState<'zh-tw' | 'en'>('zh-tw')
  const supabase = useMemo(() => createClient(), [])

  //* 表單狀態
  const [formData, setFormData] = useState({
    slug: '',
    'zh-tw': { name: '' },
    en: { name: '' },
  })

  //* 載入標籤列表
  useEffect(() => {
    loadTags()
  }, [])

  const loadTags = async () => {
    try {
      setLoading(true)
      const data = await getTags(supabase)
      setTags(data)
    } catch (error) {
      toast.error(t('loadError'))
    } finally {
      setLoading(false)
    }
  }

  //* 開啟新增彈窗
  const handleCreate = () => {
    setEditingTag(null)
    setFormData({
      slug: '',
      'zh-tw': { name: '' },
      en: { name: '' },
    })
    setCurrentLocale('zh-tw')
    setIsModalOpen(true)
  }

  //* 開啟編輯彈窗
  const handleEdit = (tag: Tag) => {
    setEditingTag(tag)
    setFormData({
      slug: tag.slug,
      'zh-tw': tag.locales['zh-tw'],
      en: tag.locales.en,
    })
    setCurrentLocale('zh-tw')
    setIsModalOpen(true)
  }

  //* 儲存標籤
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

      const input: CreateTagInput = {
        slug: formData.slug,
        locales: {
          'zh-tw': formData['zh-tw'],
          en: formData.en,
        },
      }

      if (editingTag) {
        // 更新
        await updateTag(supabase, editingTag.id, input)
        toast.success(t('updateSuccess'))
      } else {
        // 新增
        await createTag(supabase, input)
        toast.success(t('createSuccess'))
      }

      setIsModalOpen(false)
      loadTags()
    } catch (error) {
      toast.error(t('saveError'))
    }
  }

  //* 刪除標籤
  const handleDelete = async (tag: Tag) => {
    const ok = await confirm({
      title: t('deleteConfirmTitle'),
      message: t('deleteConfirmMessage', { name: tag.locales['zh-tw'].name }),
      danger: true,
    })
    if (!ok) return

    try {
      await deleteTag(supabase, tag.id)
      toast.success(t('deleteSuccess'))
      loadTags()
    } catch (error: any) {
      toast.error(error.message || t('deleteError'))
    }
  }

  return (
    <div className={style.tags_page}>
      <div className={style.container}>
        {/* 標題列 */}
        <div className={style.header}>
          <div className={style.title_section}>
            <h1 className={style.title}>{t('heading')}</h1>
            <p className={style.subtitle}>
              {t('count.total')}
              {tags.length}
              {t('count.unit')}
            </p>
          </div>
          <Button onClick={handleCreate}>{t('newTag')}</Button>
        </div>

        {/* 標籤列表 */}
        {loading ? (
          <div className={style.loading}>{t('loading')}</div>
        ) : tags.length === 0 ? (
          <div className={style.empty}>
            <p>{t('empty')}</p>
            <Button onClick={handleCreate}>{t('createFirst')}</Button>
          </div>
        ) : (
          <div className={style.table_wrapper}>
            <table className={style.table}>
              <thead>
                <tr>
                  <th>{t('table.slug')}</th>
                  <th>{t('table.nameZh')}</th>
                  <th>{t('table.nameEn')}</th>
                  <th>{t('table.postCount')}</th>
                  <th>{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {tags.map((tag) => (
                  <tr key={tag.id}>
                    <td>
                      <code className={style.slug}>{tag.slug}</code>
                    </td>
                    <td>{tag.locales['zh-tw'].name}</td>
                    <td>{tag.locales.en.name}</td>
                    <td>{tag.postCount ?? t('none')}</td>
                    <td>
                      <div className={style.actions}>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => handleEdit(tag)}
                        >
                          {t('edit')}
                        </Button>
                        <Button
                          variant="danger"
                          size="small"
                          onClick={() => handleDelete(tag)}
                          disabled={(tag.postCount ?? 0) > 0}
                        >
                          {t('delete')}
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
          title={editingTag ? t('modal.editTitle') : t('modal.newTitle')}
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
                    [currentLocale]: { name: value },
                  })
                }
                placeholder={t('modal.namePlaceholder')}
                required
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

