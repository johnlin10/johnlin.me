'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import type { Post } from '@/app/types/blog'
import { PostEditorProvider } from '@/app/components/admin/PostEditor/PostEditorProvider'
import { AiAssistProvider } from '@/app/components/admin/PostEditor/useAiAssist'
import EditorTopBar from '@/app/components/admin/PostEditor/EditorTopBar/EditorTopBar'
import Button from '@/app/components/admin/Button/Button'
import style from '@/app/components/admin/PostEditor/editorShell.module.scss'

/**
 * Substack 式分步編輯流程的共用外框。App Router 在 write ↔ settings 之間
 * 切換時不會 unmount 這個 layout，PostEditorProvider 的 state 因此完整保留。
 * @param props.id 文章 id
 * @param props.post 文章；找不到是 null，伺服器端沒抓到是 undefined
 */
export default function PostEditorShell({
  id,
  post,
  children,
}: {
  id: string
  post: Post | null | undefined
  children: React.ReactNode
}) {
  const t = useTranslations('AdminPage.posts.detail')
  const router = useRouter()
  if (post === null) {
    return (
      <div className={style.shell}>
        <div className={style.error_container}>
          <p className={style.error_message}>{t('notFound')}</p>
          <Button onClick={() => router.push('/posts')}>
            {t('backToList')}
          </Button>
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className={style.shell}>
        <div className={style.error_container}>
          <p className={style.error_message}>{t('loadError')}</p>
          <div className={style.error_actions}>
            <Button
              variant="secondary"
              onClick={() => router.push('/posts')}
            >
              {t('backToList')}
            </Button>
            <Button onClick={() => router.refresh()}>{t('retry')}</Button>
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
