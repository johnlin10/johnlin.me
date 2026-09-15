'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { createClient } from '@/app/lib/supabase/client'
import { isUniqueViolation } from '@/app/lib/supabase/errors'
import {
  deleteRow,
  getCourses,
  getSemesters,
  getSlots,
  getTeachers,
  insertRow,
  updateRow,
  type Course,
  type Semester,
  type Slot,
  type Teacher,
} from '@/app/lib/supabase/schedule'
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

export default function SchedulePage() {
  const t = useTranslations('ToolsPage.schedule')
  const format = useFormatter()
  const toast = useToast()
  const confirm = useConfirm()
  const supabase = useMemo(() => createClient(), [])

  const [semesters, setSemesters] = useState<Semester[]>([])
  const [semesterId, setSemesterId] = useState('')
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [slotForm, setSlotForm] = useState<SlotForm | null>(null)
  const [courseForm, setCourseForm] = useState<CourseForm | null>(null)
  const [teacherForm, setTeacherForm] = useState<NameForm | null>(null)
  const [semesterForm, setSemesterForm] = useState<NameForm | null>(null)

  const refresh = useCallback(
    async (id: string) => {
      const [teacherList, courseList, slotList] = await Promise.all([
        getTeachers(supabase),
        id ? getCourses(supabase, id) : [],
        id ? getSlots(supabase, id) : [],
      ])
      setTeachers(teacherList)
      setCourses(courseList)
      setSlots(slotList)
    },
    [supabase],
  )

  useEffect(() => {
    getSemesters(supabase)
      .then((list) => {
        setSemesters(list)
        setSemesterId(list[0]?.id ?? '')
      })
      .catch(() => toast.error(t('loadError')))
      .finally(() => setLoading(false))
  }, [supabase])

  useEffect(() => {
    refresh(semesterId).catch(() => toast.error(t('loadError')))
  }, [semesterId, refresh])

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

  const changeSemester = (value: string) => {
    if (value === NEW_SEMESTER) setSemesterForm({ value: '' })
    else setSemesterId(value)
  }

  const saveSemester = async () => {
    if (!semesterForm) return
    const code = semesterForm.value.trim()
    if (!SEMESTER_CODE.test(code)) return toast.error(t('semester.codeInvalid'))
    try {
      if (semesterForm.id) {
        await updateRow(supabase, 'semesters', semesterForm.id, { code })
      } else {
        const created = await insertRow(supabase, 'semesters', { code })
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
        day: time.day,
        start_period: time.start,
        end_period: time.end,
        location: slotForm.location.trim() || null,
      }
      if (slotForm.id) await updateRow(supabase, 'schedule_slots', slotForm.id, row)
      else await insertRow(supabase, 'schedule_slots', row)
      setSlotForm(null)
      await refresh(semesterId)
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
      await refresh(semesterId)
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
      await refresh(semesterId)
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
      await refresh(semesterId)
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
      await refresh(semesterId)
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
      await refresh(semesterId)
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
            )
          }
        />

        {loading ? (
          <div className={style.loading}>
            <p>{t('loading')}</p>
          </div>
        ) : !semester ? (
          <div className={style.empty}>
            <p>{t('noSemester')}</p>
            <Button onClick={() => setSemesterForm({ value: '' })}>{t('semester.new')}</Button>
          </div>
        ) : (
          <>
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

                <section className={style.group}>
                  <div className={style.groupHead}>
                    <h2 className={style.groupTitle}>{t('semester.title')}</h2>
                  </div>
                  <button
                    type="button"
                    className={style.item}
                    onClick={() => setSemesterForm({ id: semester.id, value: semester.code })}
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
          isOpen={semesterForm !== null}
          onClose={() => setSemesterForm(null)}
          title={semesterForm?.id ? t('semester.editTitle') : t('semester.newTitle')}
          size="small"
        >
          {semesterForm && (
            <div className={style.form}>
              <Input
                label={t('semester.codeLabel')}
                value={semesterForm.value}
                onChange={(value) => setSemesterForm({ ...semesterForm, value })}
                placeholder="114-1"
                helper={t('semester.codeHelper')}
                required
              />
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
