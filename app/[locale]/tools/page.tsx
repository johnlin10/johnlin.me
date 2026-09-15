'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import Icon, { type IconName } from '@/app/components/Icon/Icon'
import PageHeader from '@/app/components/admin/PageHeader/PageHeader'
import style from './tools.module.scss'

const TOOLS: { href: string; key: string; icon: IconName }[] = [
  { href: '/schedule', key: 'schedule', icon: 'calendar' },
  { href: '/links', key: 'links', icon: 'link' },
]

export default function ToolsHomePage() {
  const t = useTranslations('ToolsPage.home')
  return (
    <div className={style.home}>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <ul className={style.cards}>
        {TOOLS.map(({ href, key, icon }) => (
          <li key={key}>
            <Link href={href} className={style.card}>
              <Icon name={icon} className={style.cardIcon} />
              <span className={style.cardName}>{t(`tools.${key}.name`)}</span>
              <span className={style.cardDescription}>{t(`tools.${key}.description`)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
