import { getTranslations } from 'next-intl/server'
import AdminShell from '@/app/components/admin/AdminShell/AdminShell'
import { ToastProvider } from '@/app/components/admin/Toast/ToastProvider'
import { ConfirmDialogProvider } from '@/app/components/admin/ConfirmDialog/ConfirmDialog'
import { metadata } from '@/app/lib/metadata'
import { SITE_CONFIG } from '@/app/lib/siteConfigs'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'AdminPage' })
  return {
    ...(await metadata({
      title: t('title'),
      description: 'Dashboard',
      noIndex: true,
      appendSiteName: false,
    })),
    applicationName: SITE_CONFIG.admin.name,
    appleWebApp: {
      capable: true,
      title: SITE_CONFIG.admin.shortName,
      statusBarStyle: 'default' as const,
    },
  }
}

/**
 * 後台 Layout，只從後台子網域進得來（見 proxy.ts）。
 * 權限守衛在 proxy（除了 /login 都要檢查），
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
