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

const clip = (s: string, max: number) =>
  s.length > max ? `${s.slice(0, max - 1)}…` : s

export async function generateMetadata({
  params,
}: NotePageProps): Promise<Metadata> {
  const { locale, id } = await params
  const t = await getTranslations({ locale, namespace: 'NotesPage' })
  const supabase = await createClient()
  const note = await getNoteById(supabase, id)
  if (!note) return metadata({ title: t('page_title'), description: '' })

  // 短文沒有標題：第一句當標題，其餘當描述，兩欄才不會重複
  const [head = '', ...rest] = note.content
    .split(/\n+|(?<=[。！？])|(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
  const iso = note.publishedAt ?? note.createdAt
  const dateline = `${t('page_title')} · ${new Date(iso).toLocaleDateString(
    locale === 'en' ? 'en-US' : 'zh-TW',
    { year: 'numeric', month: 'long', day: 'numeric' },
  )}`

  return metadata({
    title: head ? clip(head, 60) : dateline,
    description:
      clip(rest.join(' '), 160) || (head ? dateline : t('description')),
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
