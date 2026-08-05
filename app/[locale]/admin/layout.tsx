import { getTranslations } from 'next-intl/server'
import AdminShell from '@/app/components/admin/AdminShell/AdminShell'
import { ToastProvider } from '@/app/components/admin/Toast/ToastProvider'
import { ConfirmDialogProvider } from '@/app/components/admin/ConfirmDialog/ConfirmDialog'
import { metadata } from '@/app/lib/metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'AdminPage' })
  return metadata({
    title: t('title'),
    description: 'Dashboard',
    noIndex: true,
    appendSiteName: false,
  })
}

/**
 * 後台 Layout。
 * 權限守衛已上移至 middleware（伺服器端統一守 /admin，login 除外），
 * 資料安全底線則由 Supabase RLS 把關，這裡負責後台版面外殼與站內提示。
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ToastProvider>
      <ConfirmDialogProvider>
        <AdminShell>{children}</AdminShell>
      </ConfirmDialogProvider>
    </ToastProvider>
  )
}
