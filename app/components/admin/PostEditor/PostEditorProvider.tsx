'use client'

import {
  createContext,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { createClient } from '@/app/lib/supabase/client'
import {
  updatePost,
  deletePost,
  isSlugExists,
  isUniqueViolation,
} from '@/app/lib/supabase/posts'
import { useToast } from '@/app/components/admin/Toast/ToastProvider'
import { useConfirm } from '@/app/components/admin/ConfirmDialog/ConfirmDialog'
import { useAutosave, type SaveState } from '@/app/lib/hooks/useAutosave'
import {
  fromPost,
  toCreateInput,
  sweepBase64,
  isPristineDraft,
  type PostDraft,
  type AutosaveableField,
} from './postDraft'
import { validateForPublish, type FieldError } from './validation'
import type {
  Post,
  SeoConfig,
  SupportedLocale,
  UpdatePostInput,
} from '@/app/types/blog'

export interface PostEditorState {
  postId: string
  draft: PostDraft
  currentLocale: SupportedLocale
  saveState: SaveState
  lastSavedAt: Date | null
  saveError: unknown
  /** 唯讀，來自初次載入時的資料列——只用於狀態顯示，不隨編輯即時更新 */
  createdAt: string
  publishedAt?: string
}

export interface PostEditorActions {
  setCurrentLocale: (locale: SupportedLocale) => void
  setField: <K extends AutosaveableField>(key: K, value: PostDraft[K]) => void
  setLocaleField: (
    locale: SupportedLocale,
    key: 'title' | 'description' | 'content',
    value: string
  ) => void
  setSeoField: (
    locale: SupportedLocale,
    key: keyof SeoConfig,
    value: string | string[]
  ) => void
  retrySave: () => void
  flush: () => Promise<void>
  goToWrite: () => Promise<void>
  goToSettings: () => Promise<void>
  exit: () => Promise<void>
  discardDraft: () => Promise<void>
  publish: () => Promise<{ ok: true } | { ok: false; errors: FieldError[] }>
  saveDraft: () => Promise<void>
  update: () => Promise<void>
  unpublish: () => Promise<void>
}

export const PostEditorStateContext = createContext<PostEditorState | null>(null)
export const PostEditorActionsContext = createContext<PostEditorActions | null>(null)

interface PostEditorProviderProps {
  postId: string
  initialPost: Post
  children: ReactNode
}

/**
 * Substack 式分步編輯流程的狀態核心。context 是快路徑，DB 才是真相來源：
 * 每次切步驟/離開都會先 flush() 待寫入的變更，settings 頁硬重整一樣拿得到最新資料。
 */
export function PostEditorProvider({
  postId,
  initialPost,
  children,
}: PostEditorProviderProps) {
  const t = useTranslations('AdminPage.postEditor.provider')
  const tValidation = useTranslations('AdminPage.postEditor.validation')
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  const confirm = useConfirm()

  const [draft, setDraft] = useState<PostDraft>(() => fromPost(initialPost))
  const draftRef = useRef(draft)
  draftRef.current = draft

  const [currentLocale, setCurrentLocale] = useState<SupportedLocale>('zh-tw')

  const save = useCallback(
    async (patch: Partial<UpdatePostInput>) => {
      try {
        await updatePost(supabase, { id: postId, ...patch })
      } catch (err) {
        if (isUniqueViolation(err)) throw new Error(t('slugConflictSave'))
        throw err
      }
    },
    [supabase, postId, t]
  )

  const {
    schedule,
    flush,
    retry: retrySave,
    markClean,
    state: saveState,
    lastSavedAt,
    error: saveError,
  } = useAutosave<Partial<UpdatePostInput>>({
    save,
    enabled: draft.status === 'draft',
  })

  //* 所有欄位變更的唯一入口：更新本地 state，再排程對應的自動儲存 patch。
  //* schedule() 副作用刻意放在 mutate 之外——setState 的 updater 必須是純函式。
  const commit = useCallback(
    (
      mutate: (d: PostDraft) => PostDraft,
      toPatch: (next: PostDraft) => Partial<UpdatePostInput> | null
    ) => {
      const next = mutate(draftRef.current)
      if (next === draftRef.current) return
      draftRef.current = next
      setDraft(next)
      const patch = toPatch(next)
      if (patch) schedule(patch)
    },
    [schedule]
  )

  const setField = useCallback(
    <K extends AutosaveableField>(key: K, value: PostDraft[K]) => {
      commit(
        (d) => (d[key] === value ? d : ({ ...d, [key]: value } as PostDraft)),
        (next) => ({ [key]: next[key] } as Partial<UpdatePostInput>)
      )
    },
    [commit]
  )

  const setLocaleField = useCallback(
    (
      locale: SupportedLocale,
      key: 'title' | 'description' | 'content',
      value: string
    ) => {
      commit(
        (d) => {
          if (d.locales[locale][key] === value) return d
          return {
            ...d,
            locales: {
              ...d.locales,
              [locale]: { ...d.locales[locale], [key]: value },
            },
          }
        },
        (next) => ({ locales: next.locales })
      )
    },
    [commit]
  )

  const setSeoField = useCallback(
    (locale: SupportedLocale, key: keyof SeoConfig, value: string | string[]) => {
      commit(
        (d) => ({
          ...d,
          locales: {
            ...d.locales,
            [locale]: {
              ...d.locales[locale],
              seo: { ...d.locales[locale].seo, [key]: value },
            },
          },
        }),
        (next) => ({ locales: next.locales })
      )
    },
    [commit]
  )

  const goToWrite = useCallback(async () => {
    await flush()
    router.push(`/admin/posts/${postId}/write`)
  }, [flush, router, postId])

  const goToSettings = useCallback(async () => {
    await flush()
    router.push(`/admin/posts/${postId}/settings`)
  }, [flush, router, postId])

  const exit = useCallback(async () => {
    // 已發布文章走手動儲存，flush() 不會偷偷幫忙存——真的有未儲存的變更時要先問過使用者
    if (draftRef.current.status === 'published' && saveState !== 'idle') {
      const ok = await confirm({
        title: t('leaveConfirmTitle'),
        message: t('leaveConfirmMessage'),
        danger: true,
      })
      if (!ok) return
    }
    await flush()
    if (isPristineDraft(draftRef.current)) {
      try {
        await deletePost(supabase, postId)
      } catch {
        // 靜默失敗即可——孤兒草稿留在列表也無妨，不值得為此中斷返回動作
      }
    }
    router.push('/admin/posts')
  }, [flush, supabase, postId, router, confirm, saveState, t])

  const discardDraft = useCallback(async () => {
    const ok = await confirm({
      title: t('discardConfirmTitle'),
      message: t('discardConfirmMessage'),
      danger: true,
    })
    if (!ok) return
    await deletePost(supabase, postId)
    toast.success(t('discardSuccess'))
    router.push('/admin/posts')
  }, [confirm, supabase, postId, toast, router, t])

  const publish = useCallback(async () => {
    await flush()
    const errors = validateForPublish(draftRef.current, {
      titleRequired: tValidation('titleRequired'),
      slugRequired: tValidation('slugRequired'),
      slugInvalid: tValidation('slugInvalid'),
    })
    if (errors.length > 0) {
      toast.error(errors[0].message)
      // 標題錯誤發生在第一步，不能只在第二步顯示紅字——直接帶使用者回去
      if (errors.some((e) => e.field === 'title')) await goToWrite()
      return { ok: false as const, errors }
    }

    const exists = await isSlugExists(supabase, draftRef.current.slug, postId)
    if (exists) {
      const message = t('slugTakenError')
      toast.error(message)
      return { ok: false as const, errors: [{ field: 'slug' as const, message }] }
    }

    try {
      const sweptLocales = await sweepBase64(supabase, draftRef.current.locales, postId)
      const finalDraft: PostDraft = { ...draftRef.current, locales: sweptLocales }
      await updatePost(supabase, {
        id: postId,
        ...toCreateInput(finalDraft),
        status: 'published',
      })
      draftRef.current = { ...finalDraft, status: 'published' }
      setDraft(draftRef.current)
      toast.success(t('publishSuccess'))
      router.push('/admin/posts')
      return { ok: true as const }
    } catch (err) {
      const message = isUniqueViolation(err)
        ? t('slugTakenError')
        : t('publishGenericError')
      toast.error(message)
      return { ok: false as const, errors: [{ field: 'slug' as const, message }] }
    }
  }, [flush, supabase, postId, toast, router, goToWrite, t, tValidation])

  const saveDraft = useCallback(async () => {
    await flush()
    try {
      const sweptLocales = await sweepBase64(supabase, draftRef.current.locales, postId)
      const finalDraft: PostDraft = { ...draftRef.current, locales: sweptLocales }
      await updatePost(supabase, {
        id: postId,
        ...toCreateInput(finalDraft),
        status: 'draft',
      })
      toast.success(t('draftSaveSuccess'))
      router.push('/admin/posts')
    } catch {
      toast.error(t('draftSaveError'))
    }
  }, [flush, supabase, postId, toast, router, t])

  const update = useCallback(async () => {
    await flush()
    try {
      const sweptLocales = await sweepBase64(supabase, draftRef.current.locales, postId)
      const finalDraft: PostDraft = { ...draftRef.current, locales: sweptLocales }
      await updatePost(supabase, {
        id: postId,
        ...toCreateInput(finalDraft),
        status: 'published',
      })
      draftRef.current = finalDraft
      setDraft(finalDraft)
      markClean()
      toast.success(t('updateSuccess'))
    } catch (err) {
      toast.error(isUniqueViolation(err) ? t('slugConflictSave') : t('updateGenericError'))
    }
  }, [flush, supabase, postId, toast, markClean, t])

  const unpublish = useCallback(async () => {
    const ok = await confirm({
      title: t('unpublishConfirmTitle'),
      message: t('unpublishConfirmMessage'),
      danger: true,
    })
    if (!ok) return
    await flush()
    await updatePost(supabase, { id: postId, status: 'draft' })
    draftRef.current = { ...draftRef.current, status: 'draft' }
    setDraft(draftRef.current)
    toast.success(t('unpublishSuccess'))
  }, [confirm, flush, supabase, postId, toast, t])

  const state: PostEditorState = useMemo(
    () => ({
      postId,
      draft,
      currentLocale,
      saveState,
      lastSavedAt,
      saveError,
      createdAt: initialPost.createdAt,
      publishedAt: initialPost.publishedAt,
    }),
    [postId, draft, currentLocale, saveState, lastSavedAt, saveError, initialPost]
  )

  const actions: PostEditorActions = useMemo(
    () => ({
      setCurrentLocale,
      setField,
      setLocaleField,
      setSeoField,
      retrySave,
      flush,
      goToWrite,
      goToSettings,
      exit,
      discardDraft,
      publish,
      saveDraft,
      update,
      unpublish,
    }),
    [
      setField,
      setLocaleField,
      setSeoField,
      retrySave,
      flush,
      goToWrite,
      goToSettings,
      exit,
      discardDraft,
      publish,
      saveDraft,
      update,
      unpublish,
    ]
  )

  return (
    <PostEditorStateContext.Provider value={state}>
      <PostEditorActionsContext.Provider value={actions}>
        {children}
      </PostEditorActionsContext.Provider>
    </PostEditorStateContext.Provider>
  )
}
