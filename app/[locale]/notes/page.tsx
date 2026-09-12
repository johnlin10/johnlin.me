import { getTranslations } from 'next-intl/server'
import { createClient } from '@/app/lib/supabase/server'
import { getPublishedNotes } from '@/app/lib/supabase/notes'
import PageContainer from '@/app/components/PageContainer/PageContainer'
import PageHeader from '@/app/components/PageHeader/PageHeader'
import NoteCard from '@/app/components/notes/NoteCard/NoteCard'
import type { SupportedLocale } from '@/app/types/blog'
import style from './notes.module.scss'

import { metadata } from '@/app/lib/metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'NotesPage' })
  return metadata({
    title: t('title'),
    description: t('description'),
    url: '/notes',
  })
}

export default async function NotesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: localeParam } = await params
  const locale = localeParam as SupportedLocale
  const t = await getTranslations({ locale, namespace: 'NotesPage' })

  const supabase = await createClient()
  const { data: notes } = await getPublishedNotes(supabase, { pageSize: 50 })

  return (
    <PageContainer maxWidth="notes">
      <PageHeader
        size="md"
        eyebrow="Notes"
        title={t('page_title')}
        lead={t('lead')}
      />

      {notes.length === 0 ? (
        <div className={style.empty}>{t('empty')}</div>
      ) : (
        <div className={style.feed}>
          {notes.map((note) => (
            <NoteCard key={note.id} note={note} locale={locale} />
          ))}
        </div>
      )}
    </PageContainer>
  )
}
