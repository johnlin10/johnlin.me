'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import {
  getPostsForAdmin,
  deletePost,
  createDraftPost,
  updatePost,
} from '@/app/lib/supabase/posts'
import { getCategories } from '@/app/lib/supabase/categories'
import { getTags } from '@/app/lib/supabase/tags'
import { createClient } from '@/app/lib/supabase/client'
import type { Post, Category, Tag, SupportedLocale } from '@/app/types/blog'
import Button from '@/app/components/admin/Button/Button'
import DataTable, {
  type DataTableColumn,
  type DataTableAction,
} from '@/app/components/admin/DataTable/DataTable'
import Popover from '@/app/components/admin/Popover/Popover'
import CategorySelector from '@/app/components/admin/Selector/CategorySelector'
import TagSelector from '@/app/components/admin/Selector/TagSelector'
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
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'draft' | 'published'
  >('all')
  const supabase = useMemo(() => createClient(), [])

  // 「分類」「標籤」欄位的就地編輯：同一時間只會開一個 Popover，
  // 用共用的 anchorRef 搭配 editing 記錄是哪一列、哪個欄位。
  const [editing, setEditing] = useState<{
    postId: string
    field: 'category' | 'tags'
  } | null>(null)
  const anchorRef = useRef<HTMLElement | null>(null)

  const openEditor = (
    e: React.MouseEvent<HTMLElement>,
    postId: string,
    field: 'category' | 'tags'
  ) => {
    anchorRef.current = e.currentTarget
    setEditing({ postId, field })
  }

  const handleCategoryChange = async (post: Post, categoryId: string) => {
    setEditing(null)
    const previous = post.categoryId
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, categoryId } : p))
    )
    try {
      await updatePost(supabase, { id: post.id, categoryId })
    } catch (error) {
      console.error('更新分類失敗:', error)
      toast.error(t('categoryUpdateError'))
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, categoryId: previous } : p))
      )
    }
  }

  const handleTagsChange = async (post: Post, tagIds: string[]) => {
    const previous = post.tagIds
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, tagIds } : p)))
    try {
      await updatePost(supabase, { id: post.id, tagIds })
    } catch (error) {
      console.error('更新標籤失敗:', error)
      toast.error(t('tagsUpdateError'))
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, tagIds: previous } : p))
      )
    }
  }

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const category of categories) {
      const name =
        category.locales[locale as SupportedLocale]?.name ||
        category.locales['zh-tw']?.name ||
        category.locales.en?.name
      if (name) map.set(category.id, name)
    }
    return map
  }, [categories, locale])

  const tagNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const tag of tags) {
      const name =
        tag.locales[locale as SupportedLocale]?.name ||
        tag.locales['zh-tw']?.name ||
        tag.locales.en?.name
      if (name) map.set(tag.id, name)
    }
    return map
  }, [tags, locale])

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

  useEffect(() => {
    getCategories(supabase)
      .then(setCategories)
      .catch((error) => console.error('載入分類失敗:', error))
    getTags(supabase)
      .then(setTags)
      .catch((error) => console.error('載入標籤失敗:', error))
  }, [supabase])

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

  const postColumns: DataTableColumn<Post>[] = [
    {
      key: 'title',
      header: t('table.title'),
      minWidth: '240px',
      wrap: true,
      render: (post) => (
        <div className={style.post_title}>
          {(() => {
            // 目前 UI 語言沒填標題時，退而顯示另一個語言的標題——
            // as-needed 雙語下這很常見（例如英文標題留空），
            // 「空白」不等於「這是一篇未命名草稿」。
            const displayTitle =
              post.locales[locale as keyof typeof post.locales]?.title ||
              post.locales['zh-tw']?.title ||
              post.locales.en?.title
            return (
              <Link
                href={`/admin/posts/${post.id}/write`}
                className={style.title_link}
              >
                {displayTitle || (
                  <span className={style.untitled}>{t('untitledDraft')}</span>
                )}
              </Link>
            )
          })()}
          <code className={style.slug}>{post.slug}</code>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('table.status.title'),
      render: (post) => (
        <span className={`${style.status_badge} ${style[post.status]}`}>
          {post.status === 'published'
            ? t('table.status.classes.published')
            : t('table.status.classes.draft')}
        </span>
      ),
    },
    {
      key: 'category',
      header: t('table.category.title'),
      render: (post) => {
        const isOpen =
          editing?.postId === post.id && editing.field === 'category'
        return (
          <>
            <button
              type="button"
              className={`${style.category} ${style.editable_cell}`}
              onClick={(e) => openEditor(e, post.id, 'category')}
            >
              {post.categoryId
                ? categoryNameById.get(post.categoryId) ??
                  t('table.category.classes.set')
                : t('table.category.classes.not_set')}
            </button>
            <Popover
              isOpen={isOpen}
              onClose={() => setEditing(null)}
              anchorRef={anchorRef}
              title={t('table.category.title')}
            >
              <CategorySelector
                value={post.categoryId}
                onChange={(categoryId) => handleCategoryChange(post, categoryId)}
                locale={locale as SupportedLocale}
                label=""
                required={false}
                compact
              />
            </Popover>
          </>
        )
      },
    },
    {
      key: 'tags',
      header: t('table.tag.title'),
      wrap: true,
      render: (post) => {
        const isOpen = editing?.postId === post.id && editing.field === 'tags'
        return (
          <>
            <button
              type="button"
              className={style.editable_cell}
              onClick={(e) => openEditor(e, post.id, 'tags')}
            >
              {post.tagIds.length === 0 ? (
                <span className={style.category}>
                  {t('table.tag.classes.not_set')}
                </span>
              ) : (
                <span className={style.tag_list}>
                  {post.tagIds.map((tagId) => {
                    const name = tagNameById.get(tagId)
                    return name ? (
                      <span key={tagId} className={style.tag_chip}>
                        {name}
                      </span>
                    ) : null
                  })}
                </span>
              )}
            </button>
            <Popover
              isOpen={isOpen}
              onClose={() => setEditing(null)}
              anchorRef={anchorRef}
              title={t('table.tag.title')}
            >
              <TagSelector
                value={post.tagIds}
                onChange={(tagIds) => handleTagsChange(post, tagIds)}
                locale={locale as SupportedLocale}
                label=""
              />
            </Popover>
          </>
        )
      },
    },
    {
      key: 'views',
      header: t('table.views'),
      // 瀏覽數只在後台看：前台兩處顯示已改成閱讀時間，計數照常累加。
      render: (post) => post.viewCount ?? 0,
    },
    {
      key: 'createdAt',
      header: t('table.created_at'),
      render: (post) => formatDate(post.createdAt),
    },
  ]

  const postActions: DataTableAction<Post>[] = [
    {
      label: t('table.actions.classes.delete'),
      variant: 'danger',
      onClick: handleDelete,
    },
  ]

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
          <DataTable
            columns={postColumns}
            data={posts}
            rowKey={(post) => post.id}
            actionsHeader={t('table.actions.title')}
            actions={postActions}
          />
        )}
      </div>
    </div>
  )
}
