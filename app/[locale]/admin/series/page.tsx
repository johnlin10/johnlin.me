'use client'

import { useState, useEffect } from 'react'
import {
  getAllSeries,
  createSeries,
  updateSeries,
  deleteSeries,
} from '@/app/lib/firebase/series'
import type { Series, CreateSeriesInput } from '@/app/types/blog'
import Modal from '@/app/components/admin/Modal/Modal'
import Button from '@/app/components/admin/Button/Button'
import Input from '@/app/components/admin/Input/Input'
import Textarea from '@/app/components/admin/Textarea/Textarea'
import style from './series.module.scss'

/**
 * 系列管理頁面
 */
export default function SeriesPage() {
  const [seriesList, setSeriesList] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSeries, setEditingSeries] = useState<Series | null>(null)
  const [currentLocale, setCurrentLocale] = useState<'zh-tw' | 'en'>('zh-tw')

  //* 表單狀態
  const [formData, setFormData] = useState({
    slug: '',
    coverImage: '',
    'zh-tw': { name: '', description: '' },
    en: { name: '', description: '' },
  })

  //* 載入系列列表
  useEffect(() => {
    loadSeries()
  }, [])

  const loadSeries = async () => {
    try {
      setLoading(true)
      const data = await getAllSeries()
      setSeriesList(data)
    } catch (error) {
      alert('載入系列失敗')
    } finally {
      setLoading(false)
    }
  }

  //* 開啟新增彈窗
  const handleCreate = () => {
    setEditingSeries(null)
    setFormData({
      slug: '',
      coverImage: '',
      'zh-tw': { name: '', description: '' },
      en: { name: '', description: '' },
    })
    setCurrentLocale('zh-tw')
    setIsModalOpen(true)
  }

  //* 開啟編輯彈窗
  const handleEdit = (series: Series) => {
    setEditingSeries(series)
    setFormData({
      slug: series.slug,
      coverImage: series.coverImage || '',
      'zh-tw': series.locales['zh-tw'],
      en: series.locales.en,
    })
    setCurrentLocale('zh-tw')
    setIsModalOpen(true)
  }

  //* 儲存系列
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

      const input: CreateSeriesInput = {
        slug: formData.slug,
        locales: {
          'zh-tw': formData['zh-tw'],
          en: formData.en,
        },
        coverImage: formData.coverImage || undefined,
      }

      if (editingSeries) {
        // 更新
        await updateSeries(editingSeries.id, input)
        alert('更新成功')
      } else {
        // 新增
        await createSeries(input)
        alert('新增成功')
      }

      setIsModalOpen(false)
      loadSeries()
    } catch (error) {
      alert('儲存失敗')
    }
  }

  //* 刪除系列
  const handleDelete = async (series: Series) => {
    if (!confirm(`確定要刪除「${series.locales['zh-tw'].name}」嗎？`)) {
      return
    }

    try {
      await deleteSeries(series.id)
      alert('刪除成功')
      loadSeries()
    } catch (error: any) {
      alert(error.message || '刪除失敗')
    }
  }

  return (
    <div className={style.series_page}>
      <div className={style.container}>
        {/* 標題列 */}
        <div className={style.header}>
          <div className={style.title_section}>
            <h1 className={style.title}>系列管理</h1>
            <p className={style.subtitle}>共 {seriesList.length} 個系列</p>
          </div>
          <Button onClick={handleCreate}>新增系列</Button>
        </div>

        {/* 系列列表 */}
        {loading ? (
          <div className={style.loading}>載入中...</div>
        ) : seriesList.length === 0 ? (
          <div className={style.empty}>
            <p>尚無系列</p>
            <Button onClick={handleCreate}>建立第一個系列</Button>
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
                {seriesList.map((series) => (
                  <tr key={series.id}>
                    <td>
                      <code className={style.slug}>{series.slug}</code>
                    </td>
                    <td>{series.locales['zh-tw'].name}</td>
                    <td>{series.locales.en.name}</td>
                    <td>{series.postCount}</td>
                    <td>
                      <div className={style.actions}>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => handleEdit(series)}
                        >
                          編輯
                        </Button>
                        <Button
                          variant="danger"
                          size="small"
                          onClick={() => handleDelete(series)}
                          disabled={series.postCount > 0}
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
          title={editingSeries ? '編輯系列' : '新增系列'}
        >
          <div className={style.form}>
            {/* Slug */}
            <Input
              label="Slug"
              value={formData.slug}
              onChange={(value) => setFormData({ ...formData, slug: value })}
              placeholder="例如：react-tutorial"
              required
              helper="URL 友善的識別碼，建議使用英文小寫"
            />

            {/* 封面圖片 URL */}
            <Input
              label="封面圖片 URL"
              value={formData.coverImage}
              onChange={(value) =>
                setFormData({ ...formData, coverImage: value })
              }
              placeholder="https://example.com/image.jpg"
              helper="選填，系列封面圖片的 URL"
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
                placeholder="系列名稱"
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
                placeholder="系列描述"
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

