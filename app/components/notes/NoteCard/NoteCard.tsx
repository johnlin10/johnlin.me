import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import type { Note } from '@/app/types/note'
import type { SupportedLocale } from '@/app/types/blog'
import NoteMedia from '@/app/components/notes/NoteMedia/NoteMedia'
import style from './NoteCard.module.scss'

/**
 * 把日期拆成月日與年份兩段。
 * @param iso ISO 日期字串
 * @param locale 顯示語系
 * @returns `{ day, year }`，左欄分兩行排，單行的 `2026年9月12日` 塞不進去
 */
function formatDate(iso: string, locale: SupportedLocale) {
  const date = new Date(iso)
  return {
    day: date.toLocaleDateString(locale === 'zh-tw' ? 'zh-TW' : 'en-US', {
      month: locale === 'zh-tw' ? 'long' : 'short',
      day: 'numeric',
    }),
    year: String(date.getFullYear()),
  }
}

/**
 * 短文卡片（X/Threads 式）。左欄日期、右欄內文與多圖，手機收合成上下堆疊。
 * asLink=true 時日期本身就是永久連結（分享用）；永久連結頁自身用 asLink=false。
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
  const { day, year } = formatDate(iso, locale)

  const date = (
    <time className={style.date} dateTime={iso}>
      <span>{day}</span>
      <span className={style.year}>{year}</span>
    </time>
  )

  return (
    <article className={style.card}>
      <div className={style.inner}>
        {asLink ? (
          <Link href={`/notes/${note.id}`} className={style.dateLink}>
            {date}
            <span className={style.srOnly}>{t('openNote')}</span>
          </Link>
        ) : (
          date
        )}

        <div className={style.body}>
          {note.content && (
            <div className={style.content}>
              {note.content
                .split(/\n+/)
                .filter(Boolean)
                .map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
            </div>
          )}

          {note.images.length > 0 && (
            <div className={style.media}>
              <NoteMedia noteId={note.id} images={note.images} />
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
