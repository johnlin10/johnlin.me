'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/lib/hooks/useAuth'
import style from './ProtectedRoute.module.scss'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedEmail?: string // 允許的 email，用於權限控制
}

/**
 * 保護路由組件
 * 只有登入使用者才能訪問
 */
export default function ProtectedRoute({
  children,
  allowedEmail,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      // 未登入，導向登入頁
      if (!user) {
        router.push('/admin/login')
        return
      }

      // 如果設定了允許的 email，檢查權限
      if (allowedEmail && user.email !== allowedEmail) {
        router.push('/admin/login')
        return
      }
    }
  }, [user, loading, allowedEmail, router])

  //* Loading 狀態
  if (loading) {
    return (
      <div className={style.protected_route}>
        <div className={style.loading}>
          <div className={style.spinner}></div>
          <p>驗證中...</p>
        </div>
      </div>
    )
  }

  //* 未登入或權限不足
  if (!user || (allowedEmail && user.email !== allowedEmail)) {
    return (
      <div className={style.protected_route}>
        <div className={style.unauthorized}>
          <p>請先登入</p>
        </div>
      </div>
    )
  }

  //* 已登入且有權限
  return <>{children}</>
}

