'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useRouter } from '@/i18n/navigation'

/**
 * /posts/<id> 本身不是一個畫面，直接導去寫作頁。
 */
export default function PostRedirectPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()

  useEffect(() => {
    router.replace(`/posts/${id}/write`)
  }, [id, router])

  return null
}
