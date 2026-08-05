'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from '@/i18n/navigation'
import { getPostsForAdmin, deletePost, createDraftPost } from '@/app/lib/supabase/posts'
import { createClient } from '@/app/lib/supabase/client'
import type { Post } from '@/app/types/blog'
import Button from '@/app/components/admin/Button/Button'
import { useToast } from '@/app/components/admin/Toast/ToastProvider'
import { useConfirm } from '@/app/components/admin/ConfirmDialog/ConfirmDialog'
import style from './posts.module.scss'

import { useLocale, useTranslations } from 'next-intl'

/**
 * 文章列表管理頁面
 */
export default function PostsPage() {
  const t = useTranslations('AdminPage.posts')
  const locale = useLocale()
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'draft' | 'published'
  >('all')
  const supabase = useMemo(() => createClient(), [])

  const handleCreate = async () => {
    if (creating) return
    setCreating(true)
    try {
      const id = await createDraftPost(supabase)
      router.push(`/admin/posts/${id}/write`)
    } catch (error) {
      console.error('建立草稿失敗:', error)
      toast.error(t('createDraftError'))
      setCreating(false)
    }
  }

  useEffect(() => {
    loadPosts()
  }, [statusFilter])

  const loadPosts = async () => {
    try {
      setLoading(true)
      const result = await getPostsForAdmin(supabase, {
        status: statusFilter === 'all' ? undefined : statusFilter,
      })
      setPosts(result)
    } catch (error) {
      console.error('載入文章失敗:', error)
      toast.error(t('loadError'))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (post: Post) => {
    const ok = await confirm({
      title: t('deleteConfirmTitle'),
      message: t('deleteConfirmMessage', {
        title: post.locales['zh-tw']?.title || post.slug,
      }),
      danger: true,
    })
    if (!ok) return

    try {
      await deletePost(supabase, post.id)
      toast.success(t('deleteSuccess'))
      loadPosts()
    } catch (error) {
      console.error('刪除失敗:', error)
      toast.error(t('deleteError'))
    }
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return t('dateFallback')
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString(locale === 'zh-tw' ? 'zh-TW' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  return (
    <div className={style.posts_page}>
      <div className={style.container}>
        {/* 標題列 */}
        <div className={style.header}>
          <div className={style.title_section}>
            <h1 className={style.title}>{t('title')}</h1>
            <p className={style.subtitle}>
              {t('post_count.total')}
              {posts.length}
              {t('post_count.unit')}
            </p>
          </div>
          <Button onClick={handleCreate} disabled={creating}>
            {t('new_post')}
          </Button>
        </div>

        {/* 篩選器 */}
        <div className={style.filters}>
          <div className={style.filter_group}>
            <button
              className={`${style.filter_button} ${
                statusFilter === 'all' ? style.active : ''
              }`}
              onClick={() => setStatusFilter('all')}
            >
              {t('filter.all')}
            </button>
            <button
              className={`${style.filter_button} ${
                statusFilter === 'published' ? style.active : ''
              }`}
              onClick={() => setStatusFilter('published')}
            >
              {t('filter.published')}
            </button>
            <button
              className={`${style.filter_button} ${
                statusFilter === 'draft' ? style.active : ''
              }`}
              onClick={() => setStatusFilter('draft')}
            >
              {t('filter.draft')}
            </button>
          </div>
        </div>

        {/* 文章列表 */}
        {loading ? (
          <div className={style.loading}>{t('loading')}</div>
        ) : posts.length === 0 ? (
          <div className={style.empty}>
            <p>{t('empty')}</p>
            <Button onClick={handleCreate} disabled={creating}>
              {t('createFirst')}
            </Button>
          </div>
        ) : (
          <div className={style.table_wrapper}>
            <table className={style.table}>
              <thead>
                <tr>
                  <th className={style.title_column}>{t('table.title')}</th>
                  <th>{t('table.status.title')}</th>
                  <th>{t('table.category.title')}</th>
                  <th>{t('table.tag.title')}</th>
                  <th>{t('table.views')}</th>
                  <th>{t('table.created_at')}</th>
                  <th>{t('table.actions.title')}</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id}>
                    <td>
                      <div className={style.post_title}>
                        {(() => {
                          // 目前 UI 語言沒填標題時，退而顯示另一個語言的標題——
                          // as-needed 雙語下這很常見（例如英文標題留空），
                          // 「空白」不等於「這是一篇未命名草稿」。
                          const displayTitle =
                            post.locales[locale as keyof typeof post.locales]
                              ?.title ||
                            post.locales['zh-tw']?.title ||
                            post.locales.en?.title
                          return displayTitle ? (
                            <span>{displayTitle}</span>
                          ) : (
                            <span className={style.untitled}>
                              {t('untitledDraft')}
                            </span>
                          )
                        })()}
                        <code className={style.slug}>{post.slug}</code>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`${style.status_badge} ${
                          style[post.status]
                        }`}
                      >
                        {post.status === 'published'
                          ? t('table.status.classes.published')
                          : t('table.status.classes.draft')}
                      </span>
                    </td>
                    <td>
                      {post.categoryId
                        ? t('table.category.classes.set')
                        : t('table.category.classes.not_set')}
                    </td>
                    <td>{post.tagIds.length}</td>
                    {/* 瀏覽數只在後台看：前台兩處顯示已改成閱讀時間，計數照常累加。 */}
                    <td>{post.viewCount ?? 0}</td>
                    <td>{formatDate(post.createdAt)}</td>
                    <td>
                      <div className={style.actions}>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() =>
                            router.push(`/admin/posts/${post.id}/write`)
                          }
                        >
                          {t('table.actions.classes.edit')}
                        </Button>
                        <Button
                          variant="danger"
                          size="small"
                          onClick={() => handleDelete(post)}
                        >
                          {t('table.actions.classes.delete')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
