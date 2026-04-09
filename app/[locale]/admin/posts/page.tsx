'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getPosts, deletePost } from '@/app/lib/firebase/posts'
import { getCategoryById } from '@/app/lib/firebase/categories'
import type { Post, PostQueryParams } from '@/app/types/blog'
import Button from '@/app/components/admin/Button/Button'
import style from './posts.module.scss'

import Page from '@/app/components/Page/Page'
import { useLocale, useTranslations } from 'next-intl'

/**
 * 文章列表管理頁面
 */
export default function PostsPage() {
  const t = useTranslations('AdminPage.posts')
  const locale = useLocale()
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'draft' | 'published'
  >('all')

  useEffect(() => {
    loadPosts()
  }, [statusFilter])

  const loadPosts = async () => {
    try {
      setLoading(true)
      const params: PostQueryParams = {
        status: statusFilter === 'all' ? undefined : statusFilter,
        pageSize: 50,
      }
      const result = await getPosts(params)
      setPosts(result.data)
    } catch (error) {
      console.error('載入文章失敗:', error)
      alert('載入文章失敗')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (post: Post) => {
    if (!confirm(`確定要刪除「${post.locales['zh-tw'].title}」嗎？`)) {
      return
    }

    try {
      await deletePost(post.id)
      alert('刪除成功')
      loadPosts()
    } catch (error) {
      console.error('刪除失敗:', error)
      alert('刪除失敗')
    }
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  return (
    <Page style={style.posts_page}>
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
          <Button onClick={() => router.push('/admin/posts/new')}>
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
          <div className={style.loading}>載入中...</div>
        ) : posts.length === 0 ? (
          <div className={style.empty}>
            <p>尚無文章</p>
            <Button onClick={() => router.push('/admin/posts/new')}>
              建立第一篇文章
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
                  <th>{t('table.created_at')}</th>
                  <th>{t('table.actions.title')}</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id}>
                    <td>
                      <div className={style.post_title}>
                        <span>
                          {post.locales[locale as keyof typeof post.locales]
                            ?.title ?? ''}
                        </span>
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
                    <td>{formatDate(post.createdAt)}</td>
                    <td>
                      <div className={style.actions}>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() =>
                            router.push(`/admin/posts/${post.id}/edit`)
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
    </Page>
  )
}
