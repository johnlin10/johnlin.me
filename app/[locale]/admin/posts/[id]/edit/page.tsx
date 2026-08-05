'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useRouter } from '@/i18n/navigation'

/**
 * 舊路由過渡用的 redirect stub。/edit 已被 /write + /settings 的分步流程取代。
 */
export default function EditPostRedirect() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()

  useEffect(() => {
    router.replace(`/admin/posts/${id}/write`)
  }, [id, router])

  return null
}
