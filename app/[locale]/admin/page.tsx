'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/lib/hooks/useAuth'
import style from './admin.module.scss'

import Page from '@/app/components/Page/Page'

/**
 * 後台首頁
 */
export default function AdminPage() {
  const { user, signOut } = useAuth()
  const router = useRouter()

  //* 處理登出
  const handleSignOut = async () => {
    try {
      await signOut()
      router.push('/admin/login')
    } catch (error) {
      alert('登出失敗')
    }
  }

  return (
    <Page style={style.admin_container}>
      <header className={style.header}>
        <h1 className={style.title}>後台管理系統</h1>
        <div className={style.user_info}>
          <span className={style.email}>{user?.email}</span>
          <button className={style.sign_out_button} onClick={handleSignOut}>
            登出
          </button>
        </div>
      </header>

      <div className={style.dashboard}>
        <h2 className={style.section_title}>內容管理</h2>

        <div className={style.cards_container}>
          <a href="/admin/posts" className={style.card}>
            <h3 className={style.card_title}>文章管理</h3>
            <p className={style.card_description}>新增、編輯、刪除文章</p>
          </a>

          <div className={style.other_cards_container}>
            <a href="/admin/categories" className={style.card}>
              <span className={style.card_title}>分類管理</span>
            </a>

            <a href="/admin/tags" className={style.card}>
              <span className={style.card_title}>標籤管理</span>
            </a>

            <a href="/admin/series" className={style.card}>
              <span className={style.card_title}>系列管理</span>
            </a>
          </div>
        </div>
      </div>
    </Page>
  )
}
