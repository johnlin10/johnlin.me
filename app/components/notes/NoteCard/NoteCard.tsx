import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import type { Note } from '@/app/types/note'
import type { SupportedLocale } from '@/app/types/blog'
import NoteMedia from '@/app/components/notes/NoteMedia/NoteMedia'
import style from './NoteCard.module.scss'

function formatDate(iso: string, locale: SupportedLocale) {
  return new Date(iso).toLocaleDateString(
    locale === 'zh-tw' ? 'zh-TW' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' },
  )
}

/**
 * 短文卡片（X/Threads 式）。純文字內文 + 可選多圖版面。
 * asLink=true 時點文字/空白處連到永久連結（stretched-link），點圖片開燈箱；
 * 永久連結頁自身用 asLink=false，不需要卡片本身可點。
 */
export default async function NoteCard({
  note,
  locale,
  asLink = true,
}: {
  note: Note
  locale: SupportedLocale
  asLink?: boolean
}) {
  const t = await getTranslations({ locale, namespace: 'NotesPage' })
  const iso = note.publishedAt ?? note.createdAt
  const date = formatDate(iso, locale)

  return (
    <article className={style.card}>
      <div className={style.inner}>
        <time className={style.time} dateTime={iso}>
          {date}
        </time>

        {asLink && (
          <Link href={`/notes/${note.id}`} className={style.stretched}>
            <span className={style.srOnly}>{t('openNote')}</span>
          </Link>
        )}

        {note.content && <p className={style.content}>{note.content}</p>}

        {note.images.length > 0 && (
          <div className={style.media}>
            <NoteMedia noteId={note.id} images={note.images} />
          </div>
        )}
      </div>
    </article>
  )
}
