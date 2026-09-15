'use client'

import { useTranslations } from 'next-intl'
import LoginPanel from '@/app/components/admin/LoginPanel/LoginPanel'

export default function ToolsLoginPage() {
  const t = useTranslations('ToolsPage.login')
  return <LoginPanel title={t('title')} />
}
