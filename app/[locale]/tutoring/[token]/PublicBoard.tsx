'use client'

import { useState, useSyncExternalStore } from 'react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import type { BusySlot, Person, PublicSession } from '@/app/lib/supabase/tutoring'
import {
  PROGRAMS,
  calendarMap,
  durationHours,
  programColor,
  shiftMonth,
  type CalendarDay,
  type Term,
} from '@/app/lib/tutoring'
import TutoringBoard, {
  WeekPicker,
  monthLabel,
  useWeekPicker,
} from '@/app/components/schedule/TutoringBoard/TutoringBoard'
import { courseColorStyle } from '@/app/lib/schedule/colors'
import PeoplePicker from '@/app/components/schedule/TutoringBoard/PeoplePicker'
import boardStyle from '@/app/components/schedule/TutoringBoard/TutoringBoard.module.scss'
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
 * 公開頁的互動部分：跟編輯頁同一套畫面，時段不能點，多一份這個月的時段表，一次看一個方案。
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
  // 中文只寫「四」；英文的 narrow 是單一字母，週二週四都是 T，所以留 Thu
  const weekday = useLocale().startsWith('zh') ? 'narrow' : 'short'
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

  // 照成員清單的順序排，跟時間軸上的一樣
  const namesOf = (ids: string[]) =>
    people
      .filter((item) => ids.includes(item.id))
      .map((item) => item.name)
      .join('、')
  const monthSessions = sessions.filter(
    (session) =>
      session.date.slice(0, 7) === picker.month && (!person || session.attendees.includes(person)),
  )
  // 這個月這位同學有參加的方案，照固定順序；選的方案這個月沒有就退回第一個
  const programs = PROGRAMS.map((item) => item.key as string).filter((key) =>
    monthSessions.some((session) => session.program === key),
  )
  const [pickedProgram, setProgram] = useState('')
  const program = programs.includes(pickedProgram) ? pickedProgram : programs[0]

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
          <section>
            <h2 className={style.listTitle}>
              {t('public.monthList', { month: monthLabel(format, picker.month, picker.today) })}
            </h2>
            {programs.length === 0 ? (
              <p className={style.empty}>{t('public.monthEmpty')}</p>
            ) : (
              <>
                <div className={style.programs} role="group" aria-label={t('session.program')}>
                  {programs.map((key) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={key === program}
                      className={`${boardStyle.chip} ${boardStyle.programChip} ${
                        key === program ? boardStyle.chipOn : ''
                      }`}
                      style={courseColorStyle(programColor(key))}
                      onClick={() => setProgram(key)}
                    >
                      {t(`programs.${key}`)}
                    </button>
                  ))}
                </div>
                <div className={style.tableWrap}>
                  <table className={style.table}>
                    <thead>
                      <tr>
                        <th>{t('public.date')}</th>
                        <th>{t('public.weekday')}</th>
                        <th>{t('public.time')}</th>
                        <th>{t('public.hours')}</th>
                        <th>{t('public.content')}</th>
                        <th>{t('public.attendees')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthSessions
                        .filter((session) => session.program === program)
                        .map((session) => {
                          const date = new Date(`${session.date}T12:00:00`)
                          return (
                            <tr key={session.id}>
                              <td>{format.dateTime(date, { month: 'numeric', day: 'numeric' })}</td>
                              <td>{format.dateTime(date, { weekday })}</td>
                              <td>
                                {session.start_time.slice(0, 5)}–{session.end_time.slice(0, 5)}
                              </td>
                              <td>{durationHours(session.start_time, session.end_time) ?? '–'}</td>
                              <td className={style.content}>{session.content || '–'}</td>
                              <td className={style.content}>{namesOf(session.attendees)}</td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )}
      </TutoringBoard>
    </div>
  )
}
