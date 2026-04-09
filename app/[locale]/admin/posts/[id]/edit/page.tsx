'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getPostById } from '@/app/lib/firebase/posts'
import type { Post } from '@/app/types/blog'
import PostEditor from '@/app/components/admin/PostEditor/PostEditor'
import style from './edit.module.scss'

/**
 * 編輯文章頁面
 */
export default function EditPostPage() {
  const params = useParams()
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadPost()
  }, [params.id])

  const loadPost = async () => {
    try {
      setLoading(true)
      const id = params.id as string
      const data = await getPostById(id)

      if (data) {
        setPost(data)
      } else {
        setError('文章不存在')
      }
    } catch (err) {
      console.error('載入文章失敗:', err)
      setError('載入文章失敗')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={style.loading_container}>
        <div className={style.spinner}></div>
        <p>載入中...</p>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className={style.error_container}>
        <h2>錯誤</h2>
        <p>{error || '文章不存在'}</p>
        <a href="/admin/posts">返回文章列表</a>
      </div>
    )
  }

  return <PostEditor post={post} mode="edit" />
}

