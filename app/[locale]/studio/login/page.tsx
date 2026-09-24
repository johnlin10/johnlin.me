'use client'

import { useTranslations } from 'next-intl'
import LoginPanel from '@/app/components/admin/LoginPanel/LoginPanel'

export default function AdminLoginPage() {
  const t = useTranslations('AdminPage.login')
  return <LoginPanel title={t('title')} />
}
