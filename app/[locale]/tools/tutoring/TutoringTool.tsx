'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { createClient } from '@/app/lib/supabase/client'
import { isUniqueViolation } from '@/app/lib/supabase/errors'
import type { Semester } from '@/app/lib/supabase/schedule'
import {
  deleteFrom,
  getMembers,
  getMonthSessions,
  getSessions,
  newToken,
  saveBusy,
  savePerson,
  saveSession,
  saveShare,
  type BusySlot,
  type Person,
  type Session,
  type Share,
  type Tutoring,
} from '@/app/lib/supabase/tutoring'
import { SITE_CONFIG } from '@/app/lib/siteConfigs'
import {
  DURATION_OPTIONS,
  PROGRAMS,
  dayOfWeek,
  durationHours,
  endOf,
  minutesOf,
  slotInEffect,
  sumHours,
  timeOverlaps,
} from '@/app/lib/tutoring'
import TutoringBoard, {
  WeekPicker,
  useWeekPicker,
} from '@/app/components/schedule/TutoringBoard/TutoringBoard'
import boardStyle from '@/app/components/schedule/TutoringBoard/TutoringBoard.module.scss'
import Icon from '@/app/components/Icon/Icon'
import PageHeader from '@/app/components/admin/PageHeader/PageHeader'
import Button from '@/app/components/admin/Button/Button'
import Input from '@/app/components/admin/Input/Input'
import Textarea from '@/app/components/admin/Textarea/Textarea'
import Modal from '@/app/components/admin/Modal/Modal'
import DropdownSelect from '@/app/components/admin/Selector/DropdownSelect'
import { useToast } from '@/app/components/admin/Toast/ToastProvider'
import { useConfirm } from '@/app/components/admin/ConfirmDialog/ConfirmDialog'
import style from './tutoring.module.scss'

type SessionForm = {
  id?: string
  program: string
  date: string
  start: string
  // 存的是時長，結束時間隨時推算得出來
  duration: number
  location: string
  teacherId: string
  note: string
  attendees: string[]
}
type PersonForm = { id?: string; name: string; role: string }
type BusyForm = {
  id?: string
  personId: string
  day: string
  start: string
  end: string
  label: string
}

/**
 * 表單欄位外框，給沒有自帶 label 的控制項用。
 * @param props.label 欄位名稱
 */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={style.field}>
      <span className={style.label}>{label}</span>
      {children}
    </div>
  )
}

/**
 * 完善就學的管理介面，首屏資料由 page.tsx 在伺服器端抓好帶進來。
 * @param props.initial 首屏資料；伺服器端沒抓到是 null
 */
export default function TutoringTool({ initial }: { initial: Tutoring | null }) {
  const t = useTranslations('ToolsPage.tutoring')
  const format = useFormatter()
  const toast = useToast()
  const confirm = useConfirm()
  const supabase = useMemo(() => createClient(), [])

  const picker = useWeekPicker()
  const { today, month, weekDates } = picker

  const semesters: Semester[] = initial?.semesters ?? []
  // 最新的學期，管理區新增忙碌時間時掛在它底下
  const semester = semesters[0] ?? null
  const [people, setPeople] = useState<Person[]>(initial?.people ?? [])
  const [busy, setBusy] = useState<BusySlot[]>(initial?.busy ?? [])
  // 課表工具換算來的，唯讀
  const [scheduleBusy, setScheduleBusy] = useState<BusySlot[]>(initial?.scheduleBusy ?? [])
  // 證照輔導的級距看總時數，所以這一份不分月份
  const [licenseAll, setLicenseAll] = useState<Session[]>(initial?.license ?? [])
  const [sessions, setSessions] = useState<Session[]>(initial?.sessions ?? [])
  // 畫面上的時段是哪個月的，首屏那個月已經隨 initial 帶來了
  const loadedMonth = useRef(initial?.month)
  const [busyPerson, setBusyPerson] = useState(
    initial?.people.find((person) => person.is_me)?.id ?? '',
  )
  const [share, setShare] = useState<Share | null>(initial?.share ?? null)
  const [sessionForm, setSessionForm] = useState<SessionForm | null>(null)
  const [personForm, setPersonForm] = useState<PersonForm | null>(null)
  const [busyForm, setBusyForm] = useState<BusyForm | null>(null)

  const refreshSessions = useCallback(
    async (target: string) => {
      const { sessions: list, license } = await getMonthSessions(supabase, target)
      setSessions(list)
      setLicenseAll(license)
      loadedMonth.current = target
    },
    [supabase],
  )

  const refreshPeople = useCallback(
    async (semesterIds: string[]) => {
      const members = await getMembers(supabase, semesterIds)
      setPeople(members.people)
      setBusy(members.busy)
      setScheduleBusy(members.scheduleBusy)
    },
    [supabase],
  )

  useEffect(() => {
    if (!initial) toast.error(t('loadError'))
  }, [])

  useEffect(() => {
    if (!month || month === loadedMonth.current) return
    refreshSessions(month).catch(() => toast.error(t('loadError')))
  }, [month, refreshSessions])

  // 自己維護的加上課表工具換算來的，比對和檢查都看這一份
  const allBusy = [...busy, ...scheduleBusy]
  const semesterIds = semesters.map((item) => item.id)
  // 課表只在自己那個學期的期間有效，開學前和寒暑假不算有課
  const inEffect = (slot: BusySlot, date: string) => slotInEffect(slot.semester_id, date, semesters)
  const personById = new Map(people.map((person) => [person.id, person]))
  const students = people.filter((person) => person.role === 'student')
  const teachers = people.filter((person) => person.role === 'teacher')
  const dayOptions = [1, 2, 3, 4, 5].map((day) => ({
    value: String(day),
    // 2024-01-01 是週一
    label: format.dateTime(new Date(2024, 0, day, 12), { weekday: 'long' }),
  }))

  //* 輔導時段

  const openNewSession = (date: string, time = '19:00') => {
    setSessionForm({
      program: PROGRAMS[0].key,
      date,
      start: time,
      duration: 2,
      location: '',
      teacherId: '',
      note: '',
      attendees: [],
    })
  }

  const openSession = (id: string) => {
    const session = sessions.find((item) => item.id === id)
    if (!session) return
    setSessionForm({
      id,
      program: session.program,
      date: session.date,
      start: session.start_time.slice(0, 5),
      duration: durationHours(session.start_time, session.end_time) ?? 1,
      location: session.location ?? '',
      teacherId: session.teacher_id ?? '',
      note: session.note ?? '',
      attendees: session.attendees,
    })
  }

  /**
   * 存檔前的檢查：有沒有人這個時間有課或已經排了別場。
   * @param form 表單內容
   * @param end 推算出來的結束時間
   * @returns 擋下來的理由；沒問題回 null
   */
  const findClash = async (form: SessionForm, end: string): Promise<string | null> => {
    if (dayOfWeek(form.date) > 5) return t('session.weekend')
    if (form.attendees.length === 0) return t('session.attendeesRequired')

    const range = { start: form.start, end }
    const involved = [...form.attendees, ...(form.teacherId ? [form.teacherId] : [])]

    const classClash = allBusy.find(
      (slot) =>
        involved.includes(slot.person_id) &&
        slot.day === dayOfWeek(form.date) &&
        inEffect(slot, form.date) &&
        timeOverlaps(range, { start: slot.start_time, end: slot.end_time }),
    )
    if (classClash) {
      return t('session.busyClash', {
        name: personById.get(classClash.person_id)?.name ?? '',
        time: `${classClash.start_time.slice(0, 5)}–${classClash.end_time.slice(0, 5)}`,
      })
    }

    // 那一天現場再查一次，改到已載入範圍外的日期也擋得住
    const sameDay = await getSessions(supabase, form.date, form.date)
    for (const session of sameDay) {
      if (session.id === form.id) continue
      if (!timeOverlaps(range, { start: session.start_time, end: session.end_time })) continue
      const who = involved.find(
        (id) => session.attendees.includes(id) || session.teacher_id === id,
      )
      if (who) {
        return t('session.sessionClash', {
          name: personById.get(who)?.name ?? '',
          program: t(`programs.${session.program}`),
        })
      }
    }

    return null
  }

  const submitSession = async () => {
    if (!sessionForm) return
    const end = endOf(sessionForm.start, sessionForm.duration)
    if (!end) return toast.error(t('session.overnight'))
    const clash = await findClash(sessionForm, end).catch(() => t('loadError'))
    if (clash) return toast.error(clash)

    try {
      await saveSession(
        supabase,
        {
          program: sessionForm.program,
          date: sessionForm.date,
          start_time: sessionForm.start,
          end_time: end,
          location: sessionForm.location.trim() || null,
          teacher_id: sessionForm.teacherId || null,
          note: sessionForm.note.trim() || null,
        },
        sessionForm.attendees,
        sessionForm.id,
      )
      setSessionForm(null)
      await refreshSessions(month)
    } catch {
      toast.error(t('saveError'))
    }
  }

  const removeSession = async () => {
    if (!sessionForm?.id) return
    const ok = await confirm({
      title: t('session.deleteTitle'),
      message: t('session.deleteMessage'),
      danger: true,
    })
    if (!ok) return
    try {
      await deleteFrom(supabase, 'tutoring_sessions', sessionForm.id)
      setSessionForm(null)
      await refreshSessions(month)
    } catch {
      toast.error(t('deleteError'))
    }
  }

  //* 成員

  const submitPerson = async () => {
    if (!personForm) return
    const name = personForm.name.trim()
    if (!name) return toast.error(t('person.nameRequired'))
    try {
      await savePerson(supabase, { name, role: personForm.role }, personForm.id)
      setPersonForm(null)
      await refreshPeople(semesterIds)
    } catch (error) {
      toast.error(isUniqueViolation(error) ? t('person.duplicate') : t('saveError'))
    }
  }

  const removePerson = async () => {
    const person = personForm?.id ? personById.get(personForm.id) : undefined
    if (!person) return
    const ok = await confirm({
      title: t('person.deleteTitle'),
      message: t('person.deleteMessage', { name: person.name }),
      danger: true,
    })
    if (!ok) return
    try {
      await deleteFrom(supabase, 'people', person.id)
      setPersonForm(null)
      if (busyPerson === person.id) setBusyPerson('')
      await Promise.all([refreshPeople(semesterIds), refreshSessions(month)])
    } catch {
      toast.error(t('deleteError'))
    }
  }

  //* 忙碌時段

  const submitBusy = async () => {
    if (!busyForm || !semester) return
    if (minutesOf(busyForm.end) <= minutesOf(busyForm.start)) {
      return toast.error(t('busy.rangeInvalid'))
    }
    try {
      await saveBusy(
        supabase,
        {
          person_id: busyForm.personId,
          semester_id: semester.id,
          day: Number(busyForm.day),
          start_time: busyForm.start,
          end_time: busyForm.end,
          label: busyForm.label.trim() || null,
        },
        busyForm.id,
      )
      setBusyForm(null)
      await refreshPeople(semesterIds)
    } catch {
      toast.error(t('saveError'))
    }
  }

  const removeBusy = async () => {
    if (!busyForm?.id) return
    const ok = await confirm({
      title: t('busy.deleteTitle'),
      message: t('busy.deleteMessage'),
      danger: true,
    })
    if (!ok) return
    try {
      await deleteFrom(supabase, 'tutoring_busy', busyForm.id)
      setBusyForm(null)
      await refreshPeople(semesterIds)
    } catch {
      toast.error(t('deleteError'))
    }
  }

  //* 公開連結

  const shareUrl = share ? `${SITE_CONFIG.url}/tutoring/${share.token}` : ''

  /**
   * 寫入公開連結的設定，成功才更新畫面。
   * @param next 新的設定
   */
  const updateShare = async (next: Share) => {
    try {
      await saveShare(supabase, next)
      setShare(next)
    } catch {
      toast.error(t('saveError'))
    }
  }

  const copyShare = async () => {
    const ok = await (navigator.clipboard?.writeText(shareUrl) ?? Promise.reject()).then(
      () => true,
      () => false,
    )
    if (ok) toast.success(t('share.copied'))
    else toast.error(t('share.copyError'))
  }

  const regenerateShare = async () => {
    if (!share) return
    const ok = await confirm({
      title: t('share.regenerateTitle'),
      message: t('share.regenerateMessage'),
      danger: true,
    })
    if (ok) await updateShare({ ...share, token: newToken() })
  }

  const monthSessions = sessions.filter((session) => session.date.slice(0, 7) === month)
  const licenseHours = Object.fromEntries(
    [...sumHours(licenseAll)].map(([id, row]) => [id, row.license]),
  )
  // 管理區只列最新學期的，舊學期的時段留著但不混進來
  const personBusy = allBusy.filter(
    (slot) => slot.person_id === busyPerson && slot.semester_id === semester?.id,
  )
  // 課表工具換算來的改不了；同一個人手動加的（例如打工）照樣能改
  const fromSchedule = (slot: BusySlot) => slot.id.startsWith('schedule-')
  const hasScheduleBusy = personBusy.some(fromSchedule)

  return (
    <div className={style.tutoring_page}>
      <WeekPicker picker={picker} className={style.subhead} />

      <div className={style.container}>
        <PageHeader
          title={t('title')}
          subtitle={t('subtitle', { count: monthSessions.length })}
          action={
            <Button
              size="small"
              onClick={() =>
                openNewSession(weekDates.includes(today) ? today : (weekDates[0] ?? today))
              }
              disabled={students.length === 0}
            >
              {t('session.new')}
            </Button>
          }
        />

        {!month ? (
          <div className={style.loading}>
            <p>{t('loading')}</p>
          </div>
        ) : (
          <>
            <TutoringBoard
              picker={picker}
              people={people}
              busy={allBusy}
              terms={semesters}
              sessions={sessions}
              licenseHours={licenseHours}
              onItemClick={openSession}
              onEmptyClick={students.length > 0 ? openNewSession : undefined}
              pickMe
            />

            <details className={style.manage}>
              <summary className={style.manageSummary}>
                {t('manage')}
                <Icon name="chevron-down" size="xs" className={style.chevron} />
              </summary>

              <div className={style.manageBody}>
                <section className={style.group}>
                  <div className={style.groupHead}>
                    <h2 className={style.groupTitle}>{t('person.title')}</h2>
                    <button
                      type="button"
                      className={style.addButton}
                      aria-label={t('person.new')}
                      title={t('person.new')}
                      onClick={() => setPersonForm({ name: '', role: 'student' })}
                    >
                      <Icon name="plus" />
                    </button>
                  </div>
                  {people.length === 0 ? (
                    <p className={style.hint}>{t('person.empty')}</p>
                  ) : (
                    <ul className={style.list}>
                      {people.map((person) => (
                        <li key={person.id}>
                          <button
                            type="button"
                            className={style.item}
                            onClick={() =>
                              setPersonForm({
                                id: person.id,
                                name: person.name,
                                role: person.role,
                              })
                            }
                          >
                            <span className={style.itemName}>{person.name}</span>
                            <span className={style.itemMeta}>{t(`person.${person.role}`)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className={style.group}>
                  <div className={style.groupHead}>
                    <h2 className={style.groupTitle}>
                      {t('busy.title')}
                      {semester && <span className={style.badge}>{semester.code}</span>}
                    </h2>
                    <button
                      type="button"
                      className={style.addButton}
                      aria-label={t('busy.new')}
                      title={t('busy.new')}
                      disabled={!semester || !busyPerson}
                      onClick={() =>
                        setBusyForm({
                          personId: busyPerson,
                          day: '1',
                          start: '08:00',
                          end: '10:00',
                          label: '',
                        })
                      }
                    >
                      <Icon name="plus" />
                    </button>
                  </div>

                  {!semester ? (
                    <p className={style.hint}>{t('busy.noSemester')}</p>
                  ) : people.length === 0 ? (
                    <p className={style.hint}>{t('busy.noPeople')}</p>
                  ) : (
                    <>
                      <DropdownSelect
                        compact
                        clearable={false}
                        value={busyPerson}
                        onChange={setBusyPerson}
                        placeholder={t('busy.pickPerson')}
                        options={people.map((person) => ({
                          value: person.id,
                          label: person.is_me ? t('person.me', { name: person.name }) : person.name,
                          divider: person.is_me,
                        }))}
                      />
                      {hasScheduleBusy && <p className={style.hint}>{t('busy.fromSchedule')}</p>}
                      {busyPerson &&
                        (personBusy.length === 0 ? (
                          <p className={style.hint}>{t('busy.empty')}</p>
                        ) : (
                          <ul className={style.list}>
                            {personBusy.map((slot) => {
                              const time = `${dayOptions[slot.day - 1].label} ${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`
                              const content = (
                                <>
                                  <span className={style.itemName}>{time}</span>
                                  {slot.label && (
                                    <span className={style.itemMeta}>{slot.label}</span>
                                  )}
                                </>
                              )
                              return (
                                <li key={slot.id}>
                                  {fromSchedule(slot) ? (
                                    <div className={style.itemStatic}>{content}</div>
                                  ) : (
                                    <button
                                      type="button"
                                      className={style.item}
                                      onClick={() =>
                                        setBusyForm({
                                          id: slot.id,
                                          personId: slot.person_id,
                                          day: String(slot.day),
                                          start: slot.start_time.slice(0, 5),
                                          end: slot.end_time.slice(0, 5),
                                          label: slot.label ?? '',
                                        })
                                      }
                                    >
                                      {content}
                                    </button>
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                        ))}
                    </>
                  )}
                </section>

                <section className={style.group}>
                  <div className={style.groupHead}>
                    <h2 className={style.groupTitle}>
                      {t('share.title')}
                      {share && !share.enabled && (
                        <span className={style.badge}>{t('share.off')}</span>
                      )}
                    </h2>
                  </div>
                  <p className={style.hint}>{t('share.hint')}</p>
                  {!share ? (
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={() => updateShare({ token: newToken(), enabled: true })}
                    >
                      {t('share.create')}
                    </Button>
                  ) : (
                    <>
                      <code className={style.shareUrl}>{shareUrl}</code>
                      <div className={style.shareActions}>
                        <Button size="small" variant="secondary" onClick={copyShare}>
                          {t('share.copy')}
                        </Button>
                        <Button
                          size="small"
                          variant="ghost"
                          onClick={() => updateShare({ ...share, enabled: !share.enabled })}
                        >
                          {share.enabled ? t('share.disable') : t('share.enable')}
                        </Button>
                        <Button size="small" variant="ghost" onClick={regenerateShare}>
                          {t('share.regenerate')}
                        </Button>
                      </div>
                    </>
                  )}
                </section>
              </div>
            </details>
          </>
        )}

        <Modal
          isOpen={sessionForm !== null}
          onClose={() => setSessionForm(null)}
          title={sessionForm?.id ? t('session.editTitle') : t('session.newTitle')}
        >
          {sessionForm && (
            <div className={style.form}>
              <Field label={t('session.program')}>
                <DropdownSelect
                  clearable={false}
                  value={sessionForm.program}
                  onChange={(program) => setSessionForm({ ...sessionForm, program })}
                  options={PROGRAMS.map((program) => ({
                    value: program.key,
                    label: t(`programs.${program.key}`),
                  }))}
                  placeholder={t('session.program')}
                />
              </Field>

              <div className={style.row}>
                <Input
                  label={t('session.date')}
                  type="date"
                  value={sessionForm.date}
                  onChange={(date) => setSessionForm({ ...sessionForm, date })}
                />
                <Input
                  label={t('session.start')}
                  type="time"
                  value={sessionForm.start}
                  onChange={(start) => setSessionForm({ ...sessionForm, start })}
                />
                <Field label={t('session.duration')}>
                  <DropdownSelect
                    clearable={false}
                    value={String(sessionForm.duration)}
                    onChange={(value) =>
                      setSessionForm({ ...sessionForm, duration: Number(value) })
                    }
                    options={DURATION_OPTIONS.map((hours) => ({
                      value: String(hours),
                      label: t('session.durationValue', { hours }),
                    }))}
                    placeholder={t('session.duration')}
                  />
                  <span className={style.endHint}>
                    {t('session.endsAt', {
                      time: endOf(sessionForm.start, sessionForm.duration) ?? '—',
                    })}
                  </span>
                </Field>
              </div>

              <Field label={t('session.attendees')}>
                <div className={style.chips}>
                  {students.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      aria-pressed={sessionForm.attendees.includes(person.id)}
                      className={`${boardStyle.chip} ${
                        sessionForm.attendees.includes(person.id) ? boardStyle.chipOn : ''
                      }`}
                      onClick={() =>
                        setSessionForm({
                          ...sessionForm,
                          attendees: sessionForm.attendees.includes(person.id)
                            ? sessionForm.attendees.filter((id) => id !== person.id)
                            : [...sessionForm.attendees, person.id],
                        })
                      }
                    >
                      {person.name}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label={t('session.teacher')}>
                <DropdownSelect
                  value={sessionForm.teacherId}
                  onChange={(teacherId) => setSessionForm({ ...sessionForm, teacherId })}
                  options={teachers.map((person) => ({ value: person.id, label: person.name }))}
                  placeholder={t('session.teacherPlaceholder')}
                />
              </Field>

              <Input
                label={t('session.location')}
                value={sessionForm.location}
                onChange={(location) => setSessionForm({ ...sessionForm, location })}
              />

              <Textarea
                label={t('session.note')}
                rows={2}
                value={sessionForm.note}
                onChange={(note) => setSessionForm({ ...sessionForm, note })}
                helper={t('session.noteHelper')}
              />

              <div className={style.form_actions}>
                {sessionForm.id && (
                  <Button variant="danger" className={style.pushStart} onClick={removeSession}>
                    {t('delete')}
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setSessionForm(null)}>
                  {t('cancel')}
                </Button>
                <Button onClick={submitSession}>{t('save')}</Button>
              </div>
            </div>
          )}
        </Modal>

        <Modal
          isOpen={personForm !== null}
          onClose={() => setPersonForm(null)}
          title={personForm?.id ? t('person.editTitle') : t('person.newTitle')}
          size="small"
        >
          {personForm && (
            <div className={style.form}>
              <Input
                label={t('person.name')}
                value={personForm.name}
                onChange={(name) => setPersonForm({ ...personForm, name })}
                required
              />
              <Field label={t('person.role')}>
                <DropdownSelect
                  clearable={false}
                  value={personForm.role}
                  onChange={(role) => setPersonForm({ ...personForm, role })}
                  options={[
                    { value: 'student', label: t('person.student') },
                    { value: 'teacher', label: t('person.teacher') },
                  ]}
                  placeholder={t('person.role')}
                />
              </Field>
              <div className={style.form_actions}>
                {personForm.id && (
                  <Button variant="danger" className={style.pushStart} onClick={removePerson}>
                    {t('delete')}
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setPersonForm(null)}>
                  {t('cancel')}
                </Button>
                <Button onClick={submitPerson}>{t('save')}</Button>
              </div>
            </div>
          )}
        </Modal>

        <Modal
          isOpen={busyForm !== null}
          onClose={() => setBusyForm(null)}
          title={busyForm?.id ? t('busy.editTitle') : t('busy.newTitle')}
          size="small"
        >
          {busyForm && (
            <div className={style.form}>
              <p className={style.hint}>
                {t('busy.forPerson', { name: personById.get(busyForm.personId)?.name ?? '' })}
              </p>
              <Field label={t('busy.day')}>
                <DropdownSelect
                  clearable={false}
                  value={busyForm.day}
                  onChange={(day) => setBusyForm({ ...busyForm, day })}
                  options={dayOptions}
                  placeholder={t('busy.day')}
                />
              </Field>
              <div className={style.pair}>
                <Input
                  label={t('busy.start')}
                  type="time"
                  value={busyForm.start}
                  onChange={(start) => setBusyForm({ ...busyForm, start })}
                />
                <Input
                  label={t('busy.end')}
                  type="time"
                  value={busyForm.end}
                  onChange={(end) => setBusyForm({ ...busyForm, end })}
                />
              </div>
              <Input
                label={t('busy.labelField')}
                value={busyForm.label}
                onChange={(label) => setBusyForm({ ...busyForm, label })}
                helper={t('busy.labelHelper')}
              />
              <div className={style.form_actions}>
                {busyForm.id && (
                  <Button variant="danger" className={style.pushStart} onClick={removeBusy}>
                    {t('delete')}
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setBusyForm(null)}>
                  {t('cancel')}
                </Button>
                <Button onClick={submitBusy}>{t('save')}</Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  )
}
