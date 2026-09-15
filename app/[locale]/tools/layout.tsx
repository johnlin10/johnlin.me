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
  const t = await getTranslations({ locale, namespace: 'ToolsPage' })
  return {
    ...(await metadata({
      title: t('title'),
      description: 'Tools',
      noIndex: true,
      appendSiteName: false,
    })),
    applicationName: SITE_CONFIG.tools.name,
    appleWebApp: {
      capable: true,
      title: SITE_CONFIG.tools.shortName,
      statusBarStyle: 'default' as const,
    },
  }
}

/**
 * 工具子網域的 Layout，只從 tools 子網域進得來（見 proxy.ts）。
 * 權限守衛在 proxy，資料安全底線由 Supabase RLS 把關。
 */
export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ToastProvider>
      <ConfirmDialogProvider>
        <AdminShell app="tools">{children}</AdminShell>
      </ConfirmDialogProvider>
    </ToastProvider>
  )
}
