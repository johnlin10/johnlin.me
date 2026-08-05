import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/app/lib/supabase/server'
import { getNoteById } from '@/app/lib/supabase/notes'
import PageContainer from '@/app/components/PageContainer/PageContainer'
import NoteCard from '@/app/components/notes/NoteCard/NoteCard'
import type { Metadata } from 'next'
import type { SupportedLocale } from '@/app/types/blog'
import style from '../notes.module.scss'

interface NotePageProps {
  params: Promise<{ locale: string; id: string }>
}

import { metadata } from '@/app/lib/metadata'

export async function generateMetadata({
  params,
}: NotePageProps): Promise<Metadata> {
  const { locale, id } = await params
  const t = await getTranslations({ locale, namespace: 'NotesPage' })
  const supabase = await createClient()
  const note = await getNoteById(supabase, id)
  if (!note) return metadata({ title: t('page_title'), description: '' })
  const snippet = note.content.slice(0, 60) || t('page_title')
  return metadata({
    title: snippet,
    description: note.content.slice(0, 160),
    image: note.images[0]?.url,
    url: `/notes/${id}`,
    type: 'article',
    publishedTime: note.publishedAt
      ? new Date(note.publishedAt).toISOString()
      : undefined,
  })
}

export default async function NotePage({ params }: NotePageProps) {
  const { locale: localeParam, id } = await params
  const locale = localeParam as SupportedLocale
  const t = await getTranslations({ locale, namespace: 'NotesPage' })

  const supabase = await createClient()
  const note = await getNoteById(supabase, id)
  if (!note || note.status !== 'published') notFound()

  return (
    <PageContainer maxWidth="content">
      <div className={style.single}>
        <NoteCard note={note} locale={locale} asLink={false} />
        <Link href="/notes" className={style.back}>
          {t('back')}
        </Link>
      </div>
    </PageContainer>
  )
}
