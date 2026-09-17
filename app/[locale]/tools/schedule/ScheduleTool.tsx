'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { createClient } from '@/app/lib/supabase/client'
import { isUniqueViolation } from '@/app/lib/supabase/errors'
import {
  copySlots,
  deleteRow,
  getCourses,
  getSemesters,
  getSlots,
  getTeachers,
  insertRow,
  updateRow,
  type Bootstrap,
  type Course,
  type Semester,
  type Slot,
  type Teacher,
} from '@/app/lib/supabase/schedule'
import { getPeople, savePerson, type Person } from '@/app/lib/supabase/tutoring'
import { PERIODS, overlaps, periodIndex } from '@/app/lib/schedule/periods'
import { COURSE_COLORS, courseColorStyle, leastUsedColor } from '@/app/lib/schedule/colors'
import ScheduleGrid, { type GridSlot } from '@/app/components/schedule/ScheduleGrid/ScheduleGrid'
import Icon from '@/app/components/Icon/Icon'
import PageHeader from '@/app/components/admin/PageHeader/PageHeader'
import Button from '@/app/components/admin/Button/Button'
import Input from '@/app/components/admin/Input/Input'
import Modal from '@/app/components/admin/Modal/Modal'
import DropdownSelect from '@/app/components/admin/Selector/DropdownSelect'
import { useToast } from '@/app/components/admin/Toast/ToastProvider'
import { useConfirm } from '@/app/components/admin/ConfirmDialog/ConfirmDialog'
import style from './schedule.module.scss'

const SEMESTER_CODE = /^\d{3}-[12]$/
const NEW_SEMESTER = '__new'
const NEW_PERSON = '__new'

type SlotForm = {
  id?: string
  courseId: string
  teacherId: string
  location: string
  day: string
  start: string
  end: string
}
type CourseForm = { id?: string; name: string; credits: string; color: string }
type NameForm = { id?: string; value: string }
type SemesterForm = { id?: string; code: string; start: string; end: string }
type PersonForm = { name: string; role: string }
type CopyForm = { fromId: string }

/**
 * 把學分欄位轉成資料庫的值。
 * @param value 輸入框的文字
 * @returns 空白回 null；不是 0 以上的整數回 undefined
 */
function parseCredits(value: string): number | null | undefined {
  if (value.trim() === '') return null
  const credits = Number(value)
  return Number.isInteger(credits) && credits >= 0 ? credits : undefined
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
 * 課程顏色的色票列。
 * @param props.label 欄位名稱
 * @param props.value 目前的顏色 key
 * @param props.onChange 選了顏色時呼叫
 */
function ColorSwatches({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (color: string) => void
}) {
  const t = useTranslations('ToolsPage.schedule.colors')
  return (
    <Field label={label}>
      <div className={style.swatches} role="radiogroup" aria-label={label}>
        {COURSE_COLORS.map(({ key }) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={value === key}
            aria-label={t(key)}
            title={t(key)}
            className={`${style.swatch} ${value === key ? style.swatchActive : ''}`}
            style={courseColorStyle(key)}
            onClick={() => onChange(key)}
          />
        ))}
      </div>
    </Field>
  )
}

/**
 * 課表工具的互動介面，首屏資料由 page.tsx 在伺服器端抓好帶進來。
 * @param props.initial 首屏資料；伺服器端沒抓到是 null
 */
export default function ScheduleTool({ initial }: { initial: Bootstrap | null }) {
  const t = useTranslations('ToolsPage.schedule')
  const format = useFormatter()
  const toast = useToast()
  const confirm = useConfirm()
  const supabase = useMemo(() => createClient(), [])

  const [semesters, setSemesters] = useState<Semester[]>(initial?.semesters ?? [])
  const [semesterId, setSemesterId] = useState(initial?.semesters[0]?.id ?? '')
  const [people, setPeople] = useState<Person[]>(initial?.people ?? [])
  const [personId, setPersonId] = useState(initial?.people[0]?.id ?? '')
  const [personForm, setPersonForm] = useState<PersonForm | null>(null)
  const [copyForm, setCopyForm] = useState<CopyForm | null>(null)
  const [teachers, setTeachers] = useState<Teacher[]>(initial?.teachers ?? [])
  const [courses, setCourses] = useState<Course[]>(initial?.courses ?? [])
  const [slots, setSlots] = useState<Slot[]>(initial?.slots ?? [])
  const [slotForm, setSlotForm] = useState<SlotForm | null>(null)
  const [courseForm, setCourseForm] = useState<CourseForm | null>(null)
  const [teacherForm, setTeacherForm] = useState<NameForm | null>(null)
  const [semesterForm, setSemesterForm] = useState<SemesterForm | null>(null)

  // 目前畫面上是哪個學期、哪個人的課表，首屏那一組已經隨 initial 帶來了
  const loaded = useRef(`${semesterId}|${personId}`)

  const refresh = useCallback(
    async (id: string, person: string) => {
      const [teacherList, courseList, slotList] = await Promise.all([
        getTeachers(supabase),
        id ? getCourses(supabase, id) : [],
        id && person ? getSlots(supabase, id, person) : [],
      ])
      setTeachers(teacherList)
      setCourses(courseList)
      setSlots(slotList)
      loaded.current = `${id}|${person}`
    },
    [supabase],
  )

  useEffect(() => {
    if (!initial) toast.error(t('loadError'))
  }, [])

  // 只有使用者換學期或換人才重新載入
  useEffect(() => {
    if (loaded.current === `${semesterId}|${personId}`) return
    refresh(semesterId, personId).catch(() => toast.error(t('loadError')))
  }, [semesterId, personId, refresh])

  const semester = semesters.find((s) => s.id === semesterId)
  const courseById = new Map(courses.map((course) => [course.id, course]))
  const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher]))

  const gridSlots: GridSlot[] = slots.map((slot) => {
    const course = courseById.get(slot.course_id)
    return {
      id: slot.id,
      day: slot.day,
      start: slot.start_period,
      end: slot.end_period,
      course: course?.name ?? null,
      teacher: slot.teacher_id ? (teacherById.get(slot.teacher_id)?.name ?? null) : null,
      location: slot.location,
      color: course?.color ?? null,
    }
  })

  const dayOptions = [1, 2, 3, 4, 5, 6, 7].map((day) => ({
    value: String(day),
    label: format.dateTime(new Date(2024, 0, day, 12), { weekday: 'long' }),
  }))
  const periodOptions = PERIODS.map((period) => ({
    value: period.code,
    label: `${period.code} · ${period.start}`,
  }))

  //* 學期

  const changePerson = (value: string) => {
    if (value === NEW_PERSON) return setPersonForm({ name: '', role: 'student' })
    // 先清空，不然新的課表載進來之前，畫面上還留著上一個人的課
    setSlots([])
    setPersonId(value)
  }

  const submitPerson = async () => {
    if (!personForm) return
    const name = personForm.name.trim()
    if (!name) return toast.error(t('person.nameRequired'))
    try {
      await savePerson(supabase, { name, role: personForm.role })
      const list = await getPeople(supabase)
      setPeople(list)
      setPersonId(list.find((person) => person.name === name)?.id ?? personId)
      setPersonForm(null)
    } catch (error) {
      toast.error(isUniqueViolation(error) ? t('person.duplicate') : t('saveError'))
    }
  }

  const submitCopy = async () => {
    if (!copyForm) return
    if (!copyForm.fromId) return toast.error(t('copy.required'))
    try {
      const count = await copySlots(supabase, semesterId, copyForm.fromId, personId)
      setCopyForm(null)
      if (count === 0) return toast.error(t('copy.none'))
      toast.success(t('copy.done', { count }))
      await refresh(semesterId, personId)
    } catch {
      toast.error(t('saveError'))
    }
  }

  const changeSemester = (value: string) => {
    if (value === NEW_SEMESTER) return setSemesterForm({ code: '', start: '', end: '' })
    setSlots([])
    setSemesterId(value)
  }

  const saveSemester = async () => {
    if (!semesterForm) return
    const code = semesterForm.code.trim()
    if (!SEMESTER_CODE.test(code)) return toast.error(t('semester.codeInvalid'))
    const { start, end } = semesterForm
    if (start && end && end < start) return toast.error(t('semester.rangeInvalid'))
    try {
      const fields = { code, start_date: start || null, end_date: end || null }
      if (semesterForm.id) {
        await updateRow(supabase, 'semesters', semesterForm.id, fields)
      } else {
        const created = await insertRow(supabase, 'semesters', fields)
        setSemesterId(created.id)
      }
      setSemesters(await getSemesters(supabase))
      setSemesterForm(null)
    } catch (error) {
      toast.error(isUniqueViolation(error) ? t('semester.duplicate') : t('saveError'))
    }
  }

  const deleteSemester = async () => {
    if (!semester) return
    if (courses.length > 0) return toast.error(t('semester.deleteBlocked'))
    const ok = await confirm({
      title: t('semester.deleteTitle'),
      message: t('semester.deleteMessage', { code: semester.code }),
      danger: true,
    })
    if (!ok) return
    try {
      await deleteRow(supabase, 'semesters', semester.id)
      const list = await getSemesters(supabase)
      setSemesterForm(null)
      setSemesters(list)
      setSemesterId(list[0]?.id ?? '')
    } catch {
      toast.error(t('deleteError'))
    }
  }

  //* 時段

  const openNewSlot = (day: number, period: string) => {
    setSlotForm({
      courseId: '',
      teacherId: '',
      location: '',
      day: String(day),
      start: period,
      end: period,
    })
  }

  const openSlot = (id: string) => {
    const slot = slots.find((s) => s.id === id)
    if (!slot) return
    setSlotForm({
      id,
      courseId: slot.course_id,
      teacherId: slot.teacher_id ?? '',
      location: slot.location ?? '',
      day: String(slot.day),
      start: slot.start_period,
      end: slot.end_period,
    })
  }

  const changeSlotCourse = (courseId: string) => {
    if (!slotForm) return
    const lastTeacherId = slots.find((s) => s.course_id === courseId && s.teacher_id)?.teacher_id
    setSlotForm({ ...slotForm, courseId, teacherId: slotForm.teacherId || (lastTeacherId ?? '') })
  }

  const saveSlot = async () => {
    if (!slotForm) return
    const time = { day: Number(slotForm.day), start: slotForm.start, end: slotForm.end }
    if (!slotForm.courseId) return toast.error(t('slot.courseRequired'))
    if (periodIndex(time.start) > periodIndex(time.end)) return toast.error(t('slot.rangeInvalid'))
    const clash = slots.find(
      (s) =>
        s.id !== slotForm.id &&
        overlaps(time, { day: s.day, start: s.start_period, end: s.end_period }),
    )
    if (clash) {
      return toast.error(t('slot.overlap', { course: courseById.get(clash.course_id)?.name ?? '' }))
    }

    try {
      const row = {
        course_id: slotForm.courseId,
        teacher_id: slotForm.teacherId || null,
        person_id: personId,
        day: time.day,
        start_period: time.start,
        end_period: time.end,
        location: slotForm.location.trim() || null,
      }
      if (slotForm.id) await updateRow(supabase, 'schedule_slots', slotForm.id, row)
      else await insertRow(supabase, 'schedule_slots', row)
      setSlotForm(null)
      await refresh(semesterId, personId)
    } catch {
      toast.error(t('saveError'))
    }
  }

  const deleteSlot = async () => {
    if (!slotForm?.id) return
    const ok = await confirm({
      title: t('slot.deleteTitle'),
      message: t('slot.deleteMessage'),
      danger: true,
    })
    if (!ok) return
    try {
      await deleteRow(supabase, 'schedule_slots', slotForm.id)
      setSlotForm(null)
      await refresh(semesterId, personId)
    } catch {
      toast.error(t('deleteError'))
    }
  }

  //* 課程

  const openNewCourse = () => {
    setSlotForm(null)
    setCourseForm({
      name: '',
      credits: '',
      color: leastUsedColor(courses.map((course) => course.color)),
    })
  }

  const saveCourse = async () => {
    if (!courseForm) return
    const name = courseForm.name.trim()
    const credits = parseCredits(courseForm.credits)
    if (!name) return toast.error(t('course.nameRequired'))
    if (credits === undefined) return toast.error(t('course.creditsInvalid'))
    try {
      const fields = { name, credits, color: courseForm.color }
      if (courseForm.id) await updateRow(supabase, 'courses', courseForm.id, fields)
      else await insertRow(supabase, 'courses', { semester_id: semesterId, ...fields })
      setCourseForm(null)
      await refresh(semesterId, personId)
    } catch (error) {
      toast.error(isUniqueViolation(error) ? t('course.duplicate') : t('saveError'))
    }
  }

  const deleteCourse = async () => {
    const course = courseForm?.id ? courseById.get(courseForm.id) : undefined
    if (!course) return
    const count = slots.filter((slot) => slot.course_id === course.id).length
    if (count > 0) return toast.error(t('course.inUse', { count }))
    const ok = await confirm({
      title: t('course.deleteTitle'),
      message: t('course.deleteMessage', { name: course.name }),
      danger: true,
    })
    if (!ok) return
    try {
      await deleteRow(supabase, 'courses', course.id)
      setCourseForm(null)
      await refresh(semesterId, personId)
    } catch {
      toast.error(t('deleteError'))
    }
  }

  //* 老師

  const saveTeacher = async () => {
    if (!teacherForm) return
    const name = teacherForm.value.trim()
    if (!name) return toast.error(t('teacher.nameRequired'))
    try {
      if (teacherForm.id) await updateRow(supabase, 'teachers', teacherForm.id, { name })
      else await insertRow(supabase, 'teachers', { name })
      setTeacherForm(null)
      await refresh(semesterId, personId)
    } catch (error) {
      toast.error(isUniqueViolation(error) ? t('teacher.duplicate') : t('saveError'))
    }
  }

  const deleteTeacher = async () => {
    const teacher = teacherForm?.id ? teacherById.get(teacherForm.id) : undefined
    if (!teacher) return
    const ok = await confirm({
      title: t('teacher.deleteTitle'),
      message: t('teacher.deleteMessage', { name: teacher.name }),
      danger: true,
    })
    if (!ok) return
    try {
      await deleteRow(supabase, 'teachers', teacher.id)
      setTeacherForm(null)
      await refresh(semesterId, personId)
    } catch {
      toast.error(t('deleteError'))
    }
  }

  return (
    <div className={style.schedule_page}>
      <div className={style.container}>
        <PageHeader
          title={t('title')}
          subtitle={semester ? t('subtitle', { count: courses.length }) : undefined}
          action={
            semesters.length > 0 && (
              <div className={style.headerSelects}>
                <div className={style.personSelect}>
                  <DropdownSelect
                    compact
                    clearable={false}
                    value={personId}
                    onChange={changePerson}
                    placeholder={t('person.title')}
                    options={[
                      ...people.map((person) => ({ value: person.id, label: person.name })),
                      { value: NEW_PERSON, label: t('person.new') },
                    ]}
                  />
                </div>
                <div className={style.semesterSelect}>
                  <DropdownSelect
                    compact
                    clearable={false}
                    value={semesterId}
                    onChange={changeSemester}
                    placeholder={t('semester.title')}
                    options={[
                      ...semesters.map((s) => ({ value: s.id, label: s.code })),
                      { value: NEW_SEMESTER, label: t('semester.new') },
                    ]}
                  />
                </div>
              </div>
            )
          }
        />

        {!semester ? (
          <div className={style.empty}>
            <p>{t('noSemester')}</p>
            <Button onClick={() => setSemesterForm({ code: '', start: '', end: '' })}>
              {t('semester.new')}
            </Button>
          </div>
        ) : people.length === 0 ? (
          <div className={style.empty}>
            <p>{t('person.empty')}</p>
            <Button onClick={() => setPersonForm({ name: '', role: 'student' })}>
              {t('person.new')}
            </Button>
          </div>
        ) : (
          <>
            {slots.length === 0 && people.length > 1 && (
              <div className={style.notice}>
                <p className={style.hint}>{t('copy.prompt')}</p>
                <Button size="small" onClick={() => setCopyForm({ fromId: '' })}>
                  {t('copy.action')}
                </Button>
              </div>
            )}

            <ScheduleGrid
              slots={gridSlots}
              busyLabel={t('busy')}
              onCellClick={openNewSlot}
              onSlotClick={openSlot}
              className={style.grid}
            />

            <details className={style.manage}>
              <summary className={style.manageSummary}>
                {t('manage')}
                <Icon name="chevron-down" size="xs" className={style.chevron} />
              </summary>

              <div className={style.manageBody}>
                <section className={style.group}>
                  <div className={style.groupHead}>
                    <h2 className={style.groupTitle}>{t('course.title')}</h2>
                    <button
                      type="button"
                      className={style.addButton}
                      aria-label={t('course.new')}
                      title={t('course.new')}
                      onClick={openNewCourse}
                    >
                      <Icon name="plus" />
                    </button>
                  </div>
                  {courses.length === 0 ? (
                    <p className={style.hint}>{t('course.empty')}</p>
                  ) : (
                    <ul className={style.list}>
                      {courses.map((course) => (
                        <li key={course.id}>
                          <button
                            type="button"
                            className={style.item}
                            onClick={() =>
                              setCourseForm({
                                id: course.id,
                                name: course.name,
                                credits: course.credits?.toString() ?? '',
                                color: course.color,
                              })
                            }
                          >
                            <span className={style.dot} style={courseColorStyle(course.color)} />
                            <span className={style.itemName}>{course.name}</span>
                            {course.credits !== null && (
                              <span className={style.itemMeta}>
                                {t('course.creditsUnit', { count: course.credits })}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className={style.group}>
                  <div className={style.groupHead}>
                    <h2 className={style.groupTitle}>{t('teacher.title')}</h2>
                    <button
                      type="button"
                      className={style.addButton}
                      aria-label={t('teacher.new')}
                      title={t('teacher.new')}
                      onClick={() => setTeacherForm({ value: '' })}
                    >
                      <Icon name="plus" />
                    </button>
                  </div>
                  {teachers.length === 0 ? (
                    <p className={style.hint}>{t('teacher.empty')}</p>
                  ) : (
                    <ul className={style.list}>
                      {teachers.map((teacher) => (
                        <li key={teacher.id}>
                          <button
                            type="button"
                            className={style.item}
                            onClick={() => setTeacherForm({ id: teacher.id, value: teacher.name })}
                          >
                            <span className={style.itemName}>{teacher.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {people.length > 1 && (
                  <section className={style.group}>
                    <div className={style.groupHead}>
                      <h2 className={style.groupTitle}>{t('copy.title')}</h2>
                    </div>
                    <button
                      type="button"
                      className={style.item}
                      onClick={() => setCopyForm({ fromId: '' })}
                    >
                      <span className={style.itemName}>{t('copy.action')}</span>
                    </button>
                  </section>
                )}

                <section className={style.group}>
                  <div className={style.groupHead}>
                    <h2 className={style.groupTitle}>{t('semester.title')}</h2>
                  </div>
                  <button
                    type="button"
                    className={style.item}
                    onClick={() =>
                      setSemesterForm({
                        id: semester.id,
                        code: semester.code,
                        start: semester.start_date ?? '',
                        end: semester.end_date ?? '',
                      })
                    }
                  >
                    <span className={style.itemName}>{semester.code}</span>
                  </button>
                </section>
              </div>
            </details>
          </>
        )}

        <Modal
          isOpen={slotForm !== null}
          onClose={() => setSlotForm(null)}
          title={slotForm?.id ? t('slot.editTitle') : t('slot.newTitle')}
        >
          {slotForm && (
            <div className={style.form}>
              {courses.length === 0 ? (
                <div className={style.notice}>
                  <p className={style.hint}>{t('slot.noCourses')}</p>
                  <Button size="small" onClick={openNewCourse}>
                    {t('course.new')}
                  </Button>
                </div>
              ) : (
                <Field label={t('slot.course')}>
                  <DropdownSelect
                    clearable={false}
                    value={slotForm.courseId}
                    onChange={changeSlotCourse}
                    options={courses.map((course) => ({ value: course.id, label: course.name }))}
                    placeholder={t('slot.coursePlaceholder')}
                  />
                </Field>
              )}

              <Field label={t('slot.teacher')}>
                <DropdownSelect
                  value={slotForm.teacherId}
                  onChange={(teacherId) => setSlotForm({ ...slotForm, teacherId })}
                  options={teachers.map((teacher) => ({ value: teacher.id, label: teacher.name }))}
                  placeholder={t('slot.teacherPlaceholder')}
                />
              </Field>

              <Input
                label={t('slot.location')}
                value={slotForm.location}
                onChange={(location) => setSlotForm({ ...slotForm, location })}
              />

              <div className={style.row}>
                <Field label={t('slot.day')}>
                  <DropdownSelect
                    clearable={false}
                    value={slotForm.day}
                    onChange={(day) => setSlotForm({ ...slotForm, day })}
                    options={dayOptions}
                    placeholder={t('slot.day')}
                  />
                </Field>
                <Field label={t('slot.start')}>
                  <DropdownSelect
                    clearable={false}
                    value={slotForm.start}
                    onChange={(start) => setSlotForm({ ...slotForm, start })}
                    options={periodOptions}
                    placeholder={t('slot.start')}
                  />
                </Field>
                <Field label={t('slot.end')}>
                  <DropdownSelect
                    clearable={false}
                    value={slotForm.end}
                    onChange={(end) => setSlotForm({ ...slotForm, end })}
                    options={periodOptions}
                    placeholder={t('slot.end')}
                  />
                </Field>
              </div>

              <div className={style.form_actions}>
                {slotForm.id && (
                  <Button variant="danger" className={style.pushStart} onClick={deleteSlot}>
                    {t('delete')}
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setSlotForm(null)}>
                  {t('cancel')}
                </Button>
                <Button onClick={saveSlot}>{t('save')}</Button>
              </div>
            </div>
          )}
        </Modal>

        <Modal
          isOpen={courseForm !== null}
          onClose={() => setCourseForm(null)}
          title={courseForm?.id ? t('course.editTitle') : t('course.newTitle')}
          size="small"
        >
          {courseForm && (
            <div className={style.form}>
              <Input
                label={t('course.name')}
                value={courseForm.name}
                onChange={(name) => setCourseForm({ ...courseForm, name })}
                required
              />
              <Input
                label={t('course.credits')}
                type="number"
                value={courseForm.credits}
                onChange={(credits) => setCourseForm({ ...courseForm, credits })}
                helper={t('course.creditsHelper')}
              />
              <ColorSwatches
                label={t('course.color')}
                value={courseForm.color}
                onChange={(color) => setCourseForm({ ...courseForm, color })}
              />
              <div className={style.form_actions}>
                {courseForm.id && (
                  <Button variant="danger" className={style.pushStart} onClick={deleteCourse}>
                    {t('delete')}
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setCourseForm(null)}>
                  {t('cancel')}
                </Button>
                <Button onClick={saveCourse}>{t('save')}</Button>
              </div>
            </div>
          )}
        </Modal>

        <Modal
          isOpen={teacherForm !== null}
          onClose={() => setTeacherForm(null)}
          title={teacherForm?.id ? t('teacher.editTitle') : t('teacher.newTitle')}
          size="small"
        >
          {teacherForm && (
            <div className={style.form}>
              <Input
                label={t('teacher.name')}
                value={teacherForm.value}
                onChange={(value) => setTeacherForm({ ...teacherForm, value })}
                required
              />
              <div className={style.form_actions}>
                {teacherForm.id && (
                  <Button variant="danger" className={style.pushStart} onClick={deleteTeacher}>
                    {t('delete')}
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setTeacherForm(null)}>
                  {t('cancel')}
                </Button>
                <Button onClick={saveTeacher}>{t('save')}</Button>
              </div>
            </div>
          )}
        </Modal>

        <Modal
          isOpen={copyForm !== null}
          onClose={() => setCopyForm(null)}
          title={t('copy.title')}
          size="small"
        >
          {copyForm && (
            <div className={style.form}>
              <Field label={t('copy.from')}>
                <DropdownSelect
                  clearable={false}
                  value={copyForm.fromId}
                  onChange={(fromId) => setCopyForm({ fromId })}
                  options={people
                    .filter((person) => person.id !== personId)
                    .map((person) => ({ value: person.id, label: person.name }))}
                  placeholder={t('copy.from')}
                />
              </Field>
              <p className={style.hint}>{t('copy.hint')}</p>
              <div className={style.form_actions}>
                <Button variant="secondary" onClick={() => setCopyForm(null)}>
                  {t('cancel')}
                </Button>
                <Button onClick={submitCopy}>{t('copy.action')}</Button>
              </div>
            </div>
          )}
        </Modal>

        <Modal
          isOpen={personForm !== null}
          onClose={() => setPersonForm(null)}
          title={t('person.newTitle')}
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
                <Button variant="secondary" onClick={() => setPersonForm(null)}>
                  {t('cancel')}
                </Button>
                <Button onClick={submitPerson}>{t('save')}</Button>
              </div>
            </div>
          )}
        </Modal>

        <Modal
          isOpen={semesterForm !== null}
          onClose={() => setSemesterForm(null)}
          title={semesterForm?.id ? t('semester.editTitle') : t('semester.newTitle')}
          size="small"
        >
          {semesterForm && (
            <div className={style.form}>
              <Input
                label={t('semester.codeLabel')}
                value={semesterForm.code}
                onChange={(code) => setSemesterForm({ ...semesterForm, code })}
                placeholder="114-1"
                helper={t('semester.codeHelper')}
                required
              />
              <div className={style.pair}>
                <Input
                  label={t('semester.start')}
                  type="date"
                  value={semesterForm.start}
                  onChange={(start) => setSemesterForm({ ...semesterForm, start })}
                />
                <Input
                  label={t('semester.end')}
                  type="date"
                  value={semesterForm.end}
                  onChange={(end) => setSemesterForm({ ...semesterForm, end })}
                />
              </div>
              <p className={style.hint}>{t('semester.rangeHelper')}</p>
              <div className={style.form_actions}>
                {semesterForm.id && (
                  <Button variant="danger" className={style.pushStart} onClick={deleteSemester}>
                    {t('delete')}
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setSemesterForm(null)}>
                  {t('cancel')}
                </Button>
                <Button onClick={saveSemester}>{t('save')}</Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  )
}
