'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/lib/hooks/useAuth'
import style from './login.module.scss'

/**
 * 後台登入頁面
 */
export default function AdminLoginPage() {
  const { user, loading, signInWithGoogle } = useAuth()
  const router = useRouter()

  //* 如果已登入，導向後台首頁
  useEffect(() => {
    if (user) {
      router.push('/admin')
    }
  }, [user, router])

  //* 處理登入
  const handleLogin = async () => {
    try {
      await signInWithGoogle()
    } catch (error) {
      alert('登入失敗，請稍後再試')
    }
  }

  //* Loading 狀態
  if (loading) {
    return (
      <div className={style.login_page}>
        <div className={style.login_container}>
          <div className={style.loading}>
            <div className={style.spinner}></div>
            <p>載入中...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={style.login_page}>
      <div className={style.login_container}>
        <div className={style.login_card}>
          <h1 className={style.title}>後台管理系統</h1>
          <p className={style.description}>請使用 Google 帳號登入</p>

          <button className={style.login_button} onClick={handleLogin}>
            <svg
              className={style.google_icon}
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            使用 Google 登入
          </button>
        </div>
      </div>
    </div>
  )
}
