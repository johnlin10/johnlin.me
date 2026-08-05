'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { getPostById } from '@/app/lib/supabase/posts'
import { createClient } from '@/app/lib/supabase/client'
import type { Post } from '@/app/types/blog'
import { PostEditorProvider } from '@/app/components/admin/PostEditor/PostEditorProvider'
import { AiAssistProvider } from '@/app/components/admin/PostEditor/useAiAssist'
import EditorTopBar from '@/app/components/admin/PostEditor/EditorTopBar/EditorTopBar'
import Button from '@/app/components/admin/Button/Button'
import style from '@/app/components/admin/PostEditor/editorShell.module.scss'

type LoadStatus = 'loading' | 'ready' | 'not-found' | 'error'

/**
 * Substack 式分步編輯流程的共用外框。App Router 在 write ↔ settings 之間
 * 切換時不會 unmount 這個 layout，PostEditorProvider 的 state 因此完整保留。
 */
export default function PostEditorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = useTranslations('AdminPage.posts.detail')
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [post, setPost] = useState<Post | null>(null)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    getPostById(supabase, id)
      .then((result) => {
        if (cancelled) return
        if (!result) {
          setStatus('not-found')
          return
        }
        setPost(result)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [id, supabase, retryToken])

  if (status === 'loading') {
    return (
      <div className={style.shell}>
        <div className={style.loading_container}>
          <div className={style.spinner} />
        </div>
      </div>
    )
  }

  if (status === 'not-found') {
    return (
      <div className={style.shell}>
        <div className={style.error_container}>
          <p className={style.error_message}>{t('notFound')}</p>
          <Button onClick={() => router.push('/admin/posts')}>
            {t('backToList')}
          </Button>
        </div>
      </div>
    )
  }

  if (status === 'error' || !post) {
    return (
      <div className={style.shell}>
        <div className={style.error_container}>
          <p className={style.error_message}>{t('loadError')}</p>
          <div className={style.error_actions}>
            <Button
              variant="secondary"
              onClick={() => router.push('/admin/posts')}
            >
              {t('backToList')}
            </Button>
            <Button onClick={() => setRetryToken((n) => n + 1)}>{t('retry')}</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <PostEditorProvider postId={id} initialPost={post}>
      <AiAssistProvider>
        <div className={style.shell}>
          <EditorTopBar />
          <div className={style.body}>{children}</div>
        </div>
      </AiAssistProvider>
    </PostEditorProvider>
  )
}
