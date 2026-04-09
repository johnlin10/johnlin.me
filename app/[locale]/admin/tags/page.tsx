'use client'

import { useState, useEffect } from 'react'
import {
  getAllTags,
  createTag,
  updateTag,
  deleteTag,
} from '@/app/lib/firebase/tags'
import type { Tag, CreateTagInput } from '@/app/types/blog'
import Modal from '@/app/components/admin/Modal/Modal'
import Button from '@/app/components/admin/Button/Button'
import Input from '@/app/components/admin/Input/Input'
import style from './tags.module.scss'

/**
 * 標籤管理頁面
 */
export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [currentLocale, setCurrentLocale] = useState<'zh-tw' | 'en'>('zh-tw')

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
      const data = await getAllTags()
      setTags(data)
    } catch (error) {
      alert('載入標籤失敗')
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
        alert('請輸入 Slug')
        return
      }
      if (!formData['zh-tw'].name || !formData.en.name) {
        alert('請填寫所有語言的名稱')
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
        await updateTag(editingTag.id, input)
        alert('更新成功')
      } else {
        // 新增
        await createTag(input)
        alert('新增成功')
      }

      setIsModalOpen(false)
      loadTags()
    } catch (error) {
      alert('儲存失敗')
    }
  }

  //* 刪除標籤
  const handleDelete = async (tag: Tag) => {
    if (!confirm(`確定要刪除「${tag.locales['zh-tw'].name}」嗎？`)) {
      return
    }

    try {
      await deleteTag(tag.id)
      alert('刪除成功')
      loadTags()
    } catch (error: any) {
      alert(error.message || '刪除失敗')
    }
  }

  return (
    <div className={style.tags_page}>
      <div className={style.container}>
        {/* 標題列 */}
        <div className={style.header}>
          <div className={style.title_section}>
            <h1 className={style.title}>標籤管理</h1>
            <p className={style.subtitle}>共 {tags.length} 個標籤</p>
          </div>
          <Button onClick={handleCreate}>新增標籤</Button>
        </div>

        {/* 標籤列表 */}
        {loading ? (
          <div className={style.loading}>載入中...</div>
        ) : tags.length === 0 ? (
          <div className={style.empty}>
            <p>尚無標籤</p>
            <Button onClick={handleCreate}>建立第一個標籤</Button>
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
                {tags.map((tag) => (
                  <tr key={tag.id}>
                    <td>
                      <code className={style.slug}>{tag.slug}</code>
                    </td>
                    <td>{tag.locales['zh-tw'].name}</td>
                    <td>{tag.locales.en.name}</td>
                    <td>{tag.postCount}</td>
                    <td>
                      <div className={style.actions}>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => handleEdit(tag)}
                        >
                          編輯
                        </Button>
                        <Button
                          variant="danger"
                          size="small"
                          onClick={() => handleDelete(tag)}
                          disabled={tag.postCount > 0}
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
          title={editingTag ? '編輯標籤' : '新增標籤'}
        >
          <div className={style.form}>
            {/* Slug */}
            <Input
              label="Slug"
              value={formData.slug}
              onChange={(value) => setFormData({ ...formData, slug: value })}
              placeholder="例如：javascript"
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
                    [currentLocale]: { name: value },
                  })
                }
                placeholder="標籤名稱"
                required
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

