'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPost, updatePost, isSlugExists } from '@/app/lib/firebase/posts'
import {
  uploadImage,
  uploadAndReplaceImagesInHtml,
} from '@/app/lib/firebase/storage'
import type { Post, CreatePostInput, SupportedLocale } from '@/app/types/blog'
import RichTextEditor from '@/app/components/admin/RichTextEditor/RichTextEditor'
import Input from '@/app/components/admin/Input/Input'
import Textarea from '@/app/components/admin/Textarea/Textarea'
import Button from '@/app/components/admin/Button/Button'
import CategorySelector from '@/app/components/admin/Selector/CategorySelector'
import TagSelector from '@/app/components/admin/Selector/TagSelector'
import SeriesSelector from '@/app/components/admin/Selector/SeriesSelector'
import style from './PostEditor.module.scss'

interface PostEditorProps {
  post?: Post
  mode: 'create' | 'edit'
}

/**
 * 文章編輯器主組件
 * 整合所有編輯功能
 */
export default function PostEditor({ post, mode }: PostEditorProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [currentLocale, setCurrentLocale] = useState<SupportedLocale>('zh-tw')

  //* 表單狀態
  const [formData, setFormData] = useState({
    slug: post?.slug || '',
    status: post?.status || 'draft',
    categoryId: post?.categoryId || '',
    tagIds: post?.tagIds || [],
    seriesId: post?.seriesId || '',
    seriesOrder: post?.seriesOrder || 1,
    coverImageUrl: post?.coverImage?.url || '',
    coverImageAlt: post?.coverImage?.alt || '',
    locales: {
      'zh-tw': {
        title: post?.locales['zh-tw']?.title || '',
        description: post?.locales['zh-tw']?.description || '',
        content: post?.locales['zh-tw']?.content || '',
        seo: {
          metaTitle: post?.locales['zh-tw']?.seo?.metaTitle || '',
          metaDescription: post?.locales['zh-tw']?.seo?.metaDescription || '',
          keywords: post?.locales['zh-tw']?.seo?.keywords || [],
        },
      },
      en: {
        title: post?.locales.en?.title || '',
        description: post?.locales.en?.description || '',
        content: post?.locales.en?.content || '',
        seo: {
          metaTitle: post?.locales.en?.seo?.metaTitle || '',
          metaDescription: post?.locales.en?.seo?.metaDescription || '',
          keywords: post?.locales.en?.seo?.keywords || [],
        },
      },
    },
  })

  //* 處理封面圖片上傳
  const handleCoverImageUpload = async (file: File) => {
    try {
      const url = await uploadImage(file, 'blog/covers')
      setFormData({ ...formData, coverImageUrl: url })
      alert('封面圖片上傳成功')
    } catch (error) {
      alert('封面圖片上傳失敗')
    }
  }

  //* 儲存文章
  const handleSave = async (publishNow: boolean = false) => {
    try {
      setSaving(true)

      // 驗證必填欄位
      if (!formData.slug) {
        alert('請輸入 Slug')
        return
      }
      if (!formData.categoryId) {
        alert('請選擇分類')
        return
      }
      if (!formData.locales['zh-tw'].title || !formData.locales.en.title) {
        alert('請填寫所有語言的標題')
        return
      }

      // 檢查 slug 是否已存在
      const slugExists = await isSlugExists(formData.slug, post?.id)
      if (slugExists) {
        alert('此 Slug 已被使用，請更換')
        return
      }

      const status = publishNow ? 'published' : formData.status

      // 處理圖片上傳
      let processedLocales = { ...formData.locales }
      if (status === 'published') {
        // 上傳並替換圖片
        const postId = post?.id || Date.now().toString()
        processedLocales['zh-tw'].content = await uploadAndReplaceImagesInHtml(
          formData.locales['zh-tw'].content,
          postId
        )
        processedLocales.en.content = await uploadAndReplaceImagesInHtml(
          formData.locales.en.content,
          postId
        )
      }

      const input: CreatePostInput = {
        slug: formData.slug,
        status,
        categoryId: formData.categoryId,
        tagIds: formData.tagIds,
        seriesId: formData.seriesId || undefined,
        seriesOrder: formData.seriesId ? formData.seriesOrder : undefined,
        coverImage: formData.coverImageUrl
          ? {
              url: formData.coverImageUrl,
              alt: formData.coverImageAlt,
            }
          : undefined,
        locales: processedLocales as any,
      }

      if (mode === 'create') {
        await createPost(input)
        alert('文章建立成功')
        router.push('/admin/posts')
      } else {
        await updatePost({ id: post!.id, ...input })
        alert('文章更新成功')
      }
    } catch (error) {
      console.error('儲存失敗:', error)
      alert('儲存失敗，請稍後再試')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={style.post_editor}>
      <div className={style.container}>
        {/* 標題列 */}
        <div className={style.header}>
          <h1 className={style.title}>
            {mode === 'create' ? '新增文章' : '編輯文章'}
          </h1>
          <div className={style.actions}>
            <Button
              variant="secondary"
              onClick={() => router.push('/admin/posts')}
              disabled={saving}
            >
              取消
            </Button>
            <Button onClick={() => handleSave(false)} disabled={saving}>
              {saving ? '儲存中...' : '儲存草稿'}
            </Button>
            <Button onClick={() => handleSave(true)} disabled={saving}>
              {saving ? '發布中...' : '發布'}
            </Button>
          </div>
        </div>

        <div className={style.editor_content}>
          {/* 左側：基本設定 */}
          <div className={style.sidebar}>
            <div className={style.section}>
              <h3 className={style.section_title}>基本設定</h3>

              <Input
                label="Slug"
                value={formData.slug}
                onChange={(value) => setFormData({ ...formData, slug: value })}
                placeholder="my-first-post"
                required
                helper="URL 友善的識別碼"
              />

              <CategorySelector
                value={formData.categoryId}
                onChange={(value) =>
                  setFormData({ ...formData, categoryId: value })
                }
                locale={currentLocale}
              />

              <TagSelector
                value={formData.tagIds}
                onChange={(value) =>
                  setFormData({ ...formData, tagIds: value })
                }
                locale={currentLocale}
              />

              <SeriesSelector
                seriesId={formData.seriesId}
                seriesOrder={formData.seriesOrder}
                onSeriesChange={(value) =>
                  setFormData({ ...formData, seriesId: value })
                }
                onOrderChange={(value) =>
                  setFormData({ ...formData, seriesOrder: value })
                }
                locale={currentLocale}
              />
            </div>

            <div className={style.section}>
              <h3 className={style.section_title}>封面圖片</h3>

              <Input
                label="圖片 URL"
                value={formData.coverImageUrl}
                onChange={(value) =>
                  setFormData({ ...formData, coverImageUrl: value })
                }
                placeholder="https://example.com/image.jpg"
              />

              <Input
                label="圖片描述 (Alt)"
                value={formData.coverImageAlt}
                onChange={(value) =>
                  setFormData({ ...formData, coverImageAlt: value })
                }
                placeholder="圖片描述"
              />

              <div className={style.upload_button}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleCoverImageUpload(file)
                  }}
                  style={{ display: 'none' }}
                  id="cover-upload"
                />
                <label htmlFor="cover-upload">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      document.getElementById('cover-upload')?.click()
                    }
                  >
                    上傳封面圖片
                  </Button>
                </label>
              </div>

              {formData.coverImageUrl && (
                <img
                  src={formData.coverImageUrl}
                  alt={formData.coverImageAlt}
                  className={style.cover_preview}
                />
              )}
            </div>
          </div>

          {/* 右側：內容編輯 */}
          <div className={style.main_content}>
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

            {/* 內容編輯 */}
            <div className={style.content_section}>
              <Input
                label="標題"
                value={formData.locales[currentLocale].title}
                onChange={(value) =>
                  setFormData({
                    ...formData,
                    locales: {
                      ...formData.locales,
                      [currentLocale]: {
                        ...formData.locales[currentLocale],
                        title: value,
                      },
                    },
                  })
                }
                placeholder="文章標題"
                required
              />

              <Textarea
                label="簡短描述"
                value={formData.locales[currentLocale].description}
                onChange={(value) =>
                  setFormData({
                    ...formData,
                    locales: {
                      ...formData.locales,
                      [currentLocale]: {
                        ...formData.locales[currentLocale],
                        description: value,
                      },
                    },
                  })
                }
                placeholder="文章簡短描述"
                rows={3}
              />

              <div className={style.editor_wrapper}>
                <label className={style.editor_label}>內容</label>
                <RichTextEditor
                  content={formData.locales[currentLocale].content}
                  onChange={(value) =>
                    setFormData({
                      ...formData,
                      locales: {
                        ...formData.locales,
                        [currentLocale]: {
                          ...formData.locales[currentLocale],
                          content: value,
                        },
                      },
                    })
                  }
                  placeholder="開始撰寫你的文章..."
                />
              </div>

              {/* SEO 設定 */}
              <div className={style.seo_section}>
                <h3 className={style.section_title}>SEO 設定</h3>

                <Input
                  label="SEO 標題"
                  value={formData.locales[currentLocale].seo.metaTitle}
                  onChange={(value) =>
                    setFormData({
                      ...formData,
                      locales: {
                        ...formData.locales,
                        [currentLocale]: {
                          ...formData.locales[currentLocale],
                          seo: {
                            ...formData.locales[currentLocale].seo,
                            metaTitle: value,
                          },
                        },
                      },
                    })
                  }
                  placeholder="留空則使用文章標題"
                  helper="建議 50-60 字元"
                />

                <Textarea
                  label="SEO 描述"
                  value={formData.locales[currentLocale].seo.metaDescription}
                  onChange={(value) =>
                    setFormData({
                      ...formData,
                      locales: {
                        ...formData.locales,
                        [currentLocale]: {
                          ...formData.locales[currentLocale],
                          seo: {
                            ...formData.locales[currentLocale].seo,
                            metaDescription: value,
                          },
                        },
                      },
                    })
                  }
                  placeholder="留空則使用文章描述"
                  rows={2}
                  helper="建議 150-160 字元"
                />

                <Input
                  label="關鍵字"
                  value={formData.locales[currentLocale].seo.keywords.join(
                    ', '
                  )}
                  onChange={(value) =>
                    setFormData({
                      ...formData,
                      locales: {
                        ...formData.locales,
                        [currentLocale]: {
                          ...formData.locales[currentLocale],
                          seo: {
                            ...formData.locales[currentLocale].seo,
                            keywords: value.split(',').map((k) => k.trim()),
                          },
                        },
                      },
                    })
                  }
                  placeholder="關鍵字1, 關鍵字2, 關鍵字3"
                  helper="用逗號分隔多個關鍵字"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

