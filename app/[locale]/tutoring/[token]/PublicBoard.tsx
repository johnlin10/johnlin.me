'use client'

import { useFormatter, useTranslations } from 'next-intl'
import type { BusySlot, Person, PublicSession } from '@/app/lib/supabase/tutoring'
import { shiftMonth, type Term } from '@/app/lib/tutoring'
import TutoringBoard, {
  WeekPicker,
  useWeekPicker,
} from '@/app/components/schedule/TutoringBoard/TutoringBoard'
import style from './tutoring-public.module.scss'

/**
 * 公開頁的互動部分：跟編輯頁同一套畫面，時段不能點，多一份這週的時段列表。
 * @param props.month 伺服器的這個月，只能往前往後翻一個月（資料只拿了這麼多）
 */
export default function PublicBoard({
  month,
  people,
  busy,
  terms,
  sessions,
  licenseHours,
}: {
  month: string
  people: Person[]
  busy: BusySlot[]
  terms: Term[]
  sessions: PublicSession[]
  licenseHours: Record<string, number>
}) {
  const t = useTranslations('ToolsPage.tutoring')
  const format = useFormatter()
  const picker = useWeekPicker({ min: shiftMonth(month, -1), max: shiftMonth(month, 1) })

  const nameOf = (id: string | null) => people.find((person) => person.id === id)?.name
  const weekSessions = sessions.filter((session) => picker.weekDates.includes(session.date))

  return (
    <div className={style.page}>
      <WeekPicker picker={picker} className={style.picker} />
      <TutoringBoard
        picker={picker}
        people={people}
        busy={busy}
        terms={terms}
        sessions={sessions}
        licenseHours={licenseHours}
      >
        {picker.month && (
          <section className={style.list}>
            <h2 className={style.listTitle}>{t('public.weekList')}</h2>
            {weekSessions.length === 0 ? (
              <p className={style.empty}>{t('public.weekEmpty')}</p>
            ) : (
              <ul>
                {weekSessions.map((session) => (
                  <li key={session.id} className={style.row}>
                    <span className={style.when}>
                      {format.dateTime(new Date(`${session.date}T12:00:00`), {
                        month: 'numeric',
                        day: 'numeric',
                        weekday: 'short',
                      })}{' '}
                      {session.start_time.slice(0, 5)}–{session.end_time.slice(0, 5)}
                    </span>
                    <span className={style.program}>{t(`programs.${session.program}`)}</span>
                    <span className={style.details}>
                      {[
                        session.location,
                        nameOf(session.teacher_id) &&
                          t('public.teacher', { name: nameOf(session.teacher_id)! }),
                        people
                          .filter((person) => session.attendees.includes(person.id))
                          .map((person) => person.name)
                          .join('、'),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </TutoringBoard>
    </div>
  )
}
