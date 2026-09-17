'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import {
  getPostsForAdmin,
  deletePost,
  createDraftPost,
  updatePost,
} from '@/app/lib/supabase/posts'
import { createClient } from '@/app/lib/supabase/client'
import { useSearchParamState } from '@/app/lib/hooks/useSearchParamState'
import type { Post, Category, Tag, SupportedLocale } from '@/app/types/blog'
import Button from '@/app/components/admin/Button/Button'
import PageHeader from '@/app/components/admin/PageHeader/PageHeader'
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

import { useFormatter, useLocale, useTranslations } from 'next-intl'

export type PostsData = { posts: Post[]; categories: Category[]; tags: Tag[] }

/**
 * 文章列表管理頁面，首屏資料由 page.tsx 在伺服器端抓好帶進來。
 * @param props.initial 文章、分類、標籤；伺服器端沒抓到是 null
 */
export default function PostsTool({ initial }: { initial: PostsData | null }) {
  const t = useTranslations('AdminPage.posts')
  const locale = useLocale()
  const format = useFormatter()
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  // 全部狀態的文章都在這裡，分頁籤只在畫面上篩
  const [posts, setPosts] = useState<Post[]>(initial?.posts ?? [])
  const categories = initial?.categories ?? []
  const tags = initial?.tags ?? []
  const [creating, setCreating] = useState(false)
  // 分頁籤狀態放在網址上，重整／分享連結都保得住。網址是使用者打得出來
  // 的輸入，只認識這三個值，其餘（?status=lol）一律當成 all。
  const [statusParam, setStatusParam] = useSearchParamState('status')
  const statusFilter: 'all' | 'draft' | 'published' =
    statusParam === 'draft' || statusParam === 'published' ? statusParam : 'all'
  const setStatusFilter = (next: 'all' | 'draft' | 'published') =>
    setStatusParam(next === 'all' ? null : next)
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
    field: 'category' | 'tags',
  ) => {
    anchorRef.current = e.currentTarget
    setEditing({ postId, field })
  }

  const handleCategoryChange = async (post: Post, categoryId: string) => {
    setEditing(null)
    const previous = post.categoryId
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, categoryId } : p)),
    )
    try {
      await updatePost(supabase, { id: post.id, categoryId })
    } catch (error) {
      console.error('更新分類失敗:', error)
      toast.error(t('categoryUpdateError'))
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, categoryId: previous } : p,
        ),
      )
    }
  }

  const handleTagsChange = async (post: Post, tagIds: string[]) => {
    const previous = post.tagIds
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, tagIds } : p)),
    )
    try {
      await updatePost(supabase, { id: post.id, tagIds })
    } catch (error) {
      console.error('更新標籤失敗:', error)
      toast.error(t('tagsUpdateError'))
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, tagIds: previous } : p)),
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
      router.push(`/posts/${id}/write`)
    } catch (error) {
      console.error('建立草稿失敗:', error)
      toast.error(t('createDraftError'))
      setCreating(false)
    }
  }

  useEffect(() => {
    if (!initial) toast.error(t('loadError'))
  }, [])

  const loadPosts = async () => {
    try {
      setPosts(await getPostsForAdmin(supabase))
    } catch (error) {
      console.error('載入文章失敗:', error)
      toast.error(t('loadError'))
    }
  }

  const visiblePosts =
    statusFilter === 'all' ? posts : posts.filter((post) => post.status === statusFilter)

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

  // 走 next-intl 的時區設定，伺服器（UTC）和瀏覽器印出來的日期才會一樣
  const formatDate = (timestamp: string) =>
    timestamp
      ? format.dateTime(new Date(timestamp), { year: 'numeric', month: '2-digit', day: '2-digit' })
      : t('dateFallback')

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
                href={`/posts/${post.id}/write`}
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
                ? (categoryNameById.get(post.categoryId) ??
                  t('table.category.classes.set'))
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
                onChange={(categoryId) =>
                  handleCategoryChange(post, categoryId)
                }
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
        <PageHeader
          title={t('title')}
          subtitle={
            <>
              {t('post_count.total')}
              {visiblePosts.length}
              {t('post_count.unit')}
            </>
          }
          action={
            <Button onClick={handleCreate} disabled={creating}>
              {t('new_post')}
            </Button>
          }
          subbar={
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
          }
        />

        {/* 文章列表 */}
        {visiblePosts.length === 0 ? (
          <div className={style.empty}>
            <p>{t('empty')}</p>
            <Button onClick={handleCreate} disabled={creating}>
              {t('createFirst')}
            </Button>
          </div>
        ) : (
          <DataTable
            columns={postColumns}
            data={visiblePosts}
            rowKey={(post) => post.id}
            actionsHeader={t('table.actions.title')}
            actions={postActions}
            actionsAs="menu"
          />
        )}
      </div>
    </div>
  )
}
