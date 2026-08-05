'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  getSeries,
  createSeries,
  updateSeries,
  deleteSeries,
} from '@/app/lib/supabase/series'
import { createClient } from '@/app/lib/supabase/client'
import type { Series, CreateSeriesInput } from '@/app/types/blog'
import Modal from '@/app/components/admin/Modal/Modal'
import Button from '@/app/components/admin/Button/Button'
import Input from '@/app/components/admin/Input/Input'
import Textarea from '@/app/components/admin/Textarea/Textarea'
import { useToast } from '@/app/components/admin/Toast/ToastProvider'
import { useConfirm } from '@/app/components/admin/ConfirmDialog/ConfirmDialog'
import style from './series.module.scss'

/**
 * 系列管理頁面
 */
export default function SeriesPage() {
  const t = useTranslations('AdminPage.series')
  const toast = useToast()
  const confirm = useConfirm()
  const [seriesList, setSeriesList] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSeries, setEditingSeries] = useState<Series | null>(null)
  const [currentLocale, setCurrentLocale] = useState<'zh-tw' | 'en'>('zh-tw')
  const supabase = useMemo(() => createClient(), [])

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
      const data = await getSeries(supabase)
      setSeriesList(data)
    } catch (error) {
      toast.error(t('loadError'))
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
        toast.error(t('slugRequired'))
        return
      }
      if (!formData['zh-tw'].name || !formData.en.name) {
        toast.error(t('nameRequired'))
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
        await updateSeries(supabase, editingSeries.id, input)
        toast.success(t('updateSuccess'))
      } else {
        // 新增
        await createSeries(supabase, input)
        toast.success(t('createSuccess'))
      }

      setIsModalOpen(false)
      loadSeries()
    } catch (error) {
      toast.error(t('saveError'))
    }
  }

  //* 刪除系列
  const handleDelete = async (series: Series) => {
    const ok = await confirm({
      title: t('deleteConfirmTitle'),
      message: t('deleteConfirmMessage', { name: series.locales['zh-tw'].name }),
      danger: true,
    })
    if (!ok) return

    try {
      await deleteSeries(supabase, series.id)
      toast.success(t('deleteSuccess'))
      loadSeries()
    } catch (error: any) {
      toast.error(error.message || t('deleteError'))
    }
  }

  return (
    <div className={style.series_page}>
      <div className={style.container}>
        {/* 標題列 */}
        <div className={style.header}>
          <div className={style.title_section}>
            <h1 className={style.title}>{t('heading')}</h1>
            <p className={style.subtitle}>
              {t('count.total')}
              {seriesList.length}
              {t('count.unit')}
            </p>
          </div>
          <Button onClick={handleCreate}>{t('newSeries')}</Button>
        </div>

        {/* 系列列表 */}
        {loading ? (
          <div className={style.loading}>{t('loading')}</div>
        ) : seriesList.length === 0 ? (
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
                {seriesList.map((series) => (
                  <tr key={series.id}>
                    <td>
                      <code className={style.slug}>{series.slug}</code>
                    </td>
                    <td>{series.locales['zh-tw'].name}</td>
                    <td>{series.locales.en.name}</td>
                    <td>{series.postCount ?? t('none')}</td>
                    <td>
                      <div className={style.actions}>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => handleEdit(series)}
                        >
                          {t('edit')}
                        </Button>
                        <Button
                          variant="danger"
                          size="small"
                          onClick={() => handleDelete(series)}
                          disabled={(series.postCount ?? 0) > 0}
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
          title={editingSeries ? t('modal.editTitle') : t('modal.newTitle')}
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

            {/* 封面圖片 URL */}
            <Input
              label={t('modal.coverImageLabel')}
              value={formData.coverImage}
              onChange={(value) =>
                setFormData({ ...formData, coverImage: value })
              }
              placeholder={t('modal.coverImagePlaceholder')}
              helper={t('modal.coverImageHelper')}
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

