import ProtectedRoute from '@/app/components/admin/ProtectedRoute/ProtectedRoute'

/**
 * 後台 Layout
 * 所有後台頁面都需要登入才能訪問
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  //* 設定允許的管理員 email（請替換為您的 email）
  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL

  return <ProtectedRoute allowedEmail={ADMIN_EMAIL}>{children}</ProtectedRoute>
}

