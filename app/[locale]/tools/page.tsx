'use client'

import { useTranslations } from 'next-intl'
import PageHeader from '@/app/components/admin/PageHeader/PageHeader'
import style from './tools.module.scss'

export default function ToolsHomePage() {
  const t = useTranslations('ToolsPage.home')
  return (
    <div className={style.home}>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <p className={style.empty}>{t('empty')}</p>
    </div>
  )
}
