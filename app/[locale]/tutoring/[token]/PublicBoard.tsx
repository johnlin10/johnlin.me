'use client'

import { useState, useSyncExternalStore } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import type { BusySlot, Person, PublicSession } from '@/app/lib/supabase/tutoring'
import { calendarMap, shiftMonth, type CalendarDay, type Term } from '@/app/lib/tutoring'
import TutoringBoard, {
  WeekPicker,
  useWeekPicker,
} from '@/app/components/schedule/TutoringBoard/TutoringBoard'
import PeoplePicker from '@/app/components/schedule/TutoringBoard/PeoplePicker'
import style from './tutoring-public.module.scss'

// 這支手機上次看的是誰
const STORAGE_KEY = 'tutoring-person'

/**
 * 讀上次選的人。私密視窗或擋掉網站資料時存取本身會丟例外。
 * @returns person id，沒有就是空字串
 */
function storedPerson() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

/**
 * 公開頁的互動部分：跟編輯頁同一套畫面，時段不能點，多一份這週的時段列表。
 * 一次只看一個同學的課表和輔導，預設第一位，選過就記在這支手機上。
 * @param props.month 伺服器的這個月，只能往前往後翻一個月（資料只拿了這麼多）
 */
export default function PublicBoard({
  month,
  people,
  busy,
  terms,
  calendar,
  sessions,
  licenseHours,
}: {
  month: string
  people: Person[]
  busy: BusySlot[]
  terms: Term[]
  calendar: CalendarDay[]
  sessions: PublicSession[]
  licenseHours: Record<string, number>
}) {
  const t = useTranslations('ToolsPage.tutoring')
  const format = useFormatter()
  const picker = useWeekPicker({ min: shiftMonth(month, -1), max: shiftMonth(month, 1) })

  const students = people.filter((person) => person.role === 'student')
  // 伺服器上沒有 localStorage，先畫第一位，瀏覽器接手後換成上次選的
  const stored = useSyncExternalStore(
    () => () => {},
    storedPerson,
    () => '',
  )
  const [picked, setPicked] = useState('')
  const person =
    [picked, stored].find((id) => students.some((student) => student.id === id)) ??
    students[0]?.id ??
    ''
  const pick = (id: string) => {
    setPicked(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {}
  }

  const nameOf = (id: string | null) => people.find((item) => item.id === id)?.name
  const weekSessions = sessions.filter(
    (session) =>
      picker.weekDates.includes(session.date) && (!person || session.attendees.includes(person)),
  )

  return (
    <div className={style.page}>
      <WeekPicker picker={picker} className={style.picker} />
      <TutoringBoard
        picker={picker}
        people={people}
        busy={busy}
        terms={terms}
        calendar={calendarMap(calendar)}
        sessions={sessions}
        licenseHours={licenseHours}
        timetable={person ? [person] : []}
        focus={person ? [person] : []}
        hoursOf={person ? [person] : undefined}
        toolbar={
          person && (
            <PeoplePicker
              people={students}
              value={[person]}
              onChange={([id]) => pick(id)}
              ariaLabel={t('picker.person')}
            />
          )
        }
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
                          .filter((item) => session.attendees.includes(item.id))
                          .map((item) => item.name)
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
