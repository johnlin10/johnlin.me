'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { createClient } from '@/app/lib/supabase/client'
import { createDraftPost } from '@/app/lib/supabase/posts'
import Button from '@/app/components/admin/Button/Button'
import style from '@/app/components/admin/PostEditor/editorShell.module.scss'

/**
 * 進入即建草稿：立刻在資料庫插入一列空白草稿取得 id，再導去寫作頁。
 * createdRef 是為了擋 React StrictMode 在 dev 模式下對 effect 的雙重呼叫——
 * ref 在重跑之間會保留，避免建出兩篇孤兒草稿。
 */
export default function NewPostPage() {
  const t = useTranslations('AdminPage.posts.new')
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const createdRef = useRef(false)
  const [error, setError] = useState(false)
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    if (createdRef.current) return
    createdRef.current = true
    setError(false)
    createDraftPost(supabase)
      .then((id) => router.replace(`/admin/posts/${id}/write`))
      .catch(() => setError(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryToken])

  if (error) {
    return (
      <div className={style.shell}>
        <div className={style.error_container}>
          <p className={style.error_message}>{t('errorMessage')}</p>
          <div className={style.error_actions}>
            <Button
              variant="secondary"
              onClick={() => router.push('/admin/posts')}
            >
              {t('backToList')}
            </Button>
            <Button
              onClick={() => {
                createdRef.current = false
                setRetryToken((n) => n + 1)
              }}
            >
              {t('retry')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={style.shell}>
      <div className={style.loading_container}>
        <div className={style.spinner} />
      </div>
    </div>
  )
}
