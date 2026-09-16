import { cache } from 'react'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { createPublicClient } from '@/app/lib/supabase/public'
import { getBoard, slotsToBusy } from '@/app/lib/supabase/tutoring'
import { metadata } from '@/app/lib/metadata'
import PageHeader from '@/app/components/PageHeader/PageHeader'
import PublicBoard from './PublicBoard'
import style from './tutoring-public.module.scss'

interface TutoringPublicPageProps {
  params: Promise<{ locale: string; token: string }>
}

// metadata 和頁面各要一次，同一個請求裡只打一次資料庫
const loadBoard = cache((token: string) => getBoard(createPublicClient(), token))

export async function generateMetadata({ params }: TutoringPublicPageProps): Promise<Metadata> {
  const { locale, token } = await params
  // token 不對的 404 頁不帶這頁的標題，不透露這個網址底下有東西
  if (!(await loadBoard(token))) return {}
  const t = await getTranslations({ locale, namespace: 'ToolsPage.tutoring.public' })
  return {
    ...(await metadata({
      title: t('title'),
      description: t('lead'),
      noIndex: true,
      appendSiteName: false,
    })),
    // 網址上的 token 就是鑰匙，點出去的連結不帶 Referer
    referrer: 'no-referrer',
  }
}

/**
 * 完善就學的公開唯讀頁。token 不對或連結關掉就 404。
 * 資料走 get_tutoring_board，只回露得出去的欄位。
 */
export default async function TutoringPublicPage({ params }: TutoringPublicPageProps) {
  const { locale, token } = await params
  const board = await loadBoard(token)
  if (!board) notFound()
  const t = await getTranslations({ locale, namespace: 'ToolsPage.tutoring.public' })

  return (
    <main className={style.shell}>
      <PageHeader size="md" title={t('title')} lead={t('lead')} />
      <PublicBoard
        month={board.month}
        people={board.people}
        busy={[...board.busy, ...slotsToBusy(board.slots)]}
        terms={board.semesters}
        sessions={board.sessions}
        licenseHours={board.license_hours}
      />
    </main>
  )
}
