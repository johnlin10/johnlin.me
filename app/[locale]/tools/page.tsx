import { getFormatter, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/app/lib/supabase/server'
import { getOverview } from '@/app/lib/supabase/overview'
import { pickAgenda, shiftDate, termProgress } from '@/app/lib/overview'
import { PERIODS, periodIndex } from '@/app/lib/schedule/periods'
import {
  MONTHLY_CAP,
  calendarMap,
  classDay,
  minutesOf,
  programColor,
  slotInEffect,
  sumHours,
} from '@/app/lib/tutoring'
import Icon, { type IconName } from '@/app/components/Icon/Icon'
import PageHeader from '@/app/components/admin/PageHeader/PageHeader'
import DayTimeline, { type DayItem } from '@/app/components/schedule/DayTimeline/DayTimeline'
import { HOUR_REM, hourRange } from '@/app/components/schedule/DayTimeline/range'
import TimelineViewport from '@/app/components/schedule/DayTimeline/TimelineViewport'
import style from './tools.module.scss'

// 順序跟側邊欄一樣：個人在前，學校在後
const TOOLS: { href: string; key: 'links' | 'qr' | 'schedule' | 'tutoring'; icon: IconName }[] = [
  { href: '/links', key: 'links', icon: 'link' },
  { href: '/qr', key: 'qr', icon: 'qrcode' },
  { href: '/schedule', key: 'schedule', icon: 'calendar' },
  { href: '/tutoring', key: 'tutoring', icon: 'users' },
]

type AgendaItem = DayItem & { kind: 'class' | 'session' }

/**
 * 工具總覽：今天（或下一個有安排的日子）要做什麼、學期走到哪、離考試週多久，卡片上帶各工具的摘要。
 * 整頁在伺服器端算，時間一律看台灣。
 */
export default async function ToolsHomePage() {
  const t = await getTranslations('ToolsPage.home')
  const tPrograms = await getTranslations('ToolsPage.tutoring.programs')
  const format = await getFormatter()

  const clock = new Date()
  const today = clock.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
  const now = clock.toLocaleTimeString('sv-SE', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
  })
  const since = new Date(clock.getTime() - 7 * 86_400_000).toISOString()
  // 月初起算本月時數；往後 30 天找下一個行程，月底一定在範圍內
  const data = await getOverview(
    await createClient(),
    `${today.slice(0, 8)}01`,
    shiftDate(today, 30),
    since,
  ).catch((error) => {
    console.error('總覽資料載入失敗:', error)
    return null
  })

  const calendar = calendarMap(data?.calendar ?? [])

  const itemsOn = (date: string): AgendaItem[] =>
    data
      ? [
          ...data.classes
            .filter(
              (slot) =>
                slot.day === classDay(date, calendar) &&
                slotInEffect(slot.semester_id, date, data.semesters),
            )
            .map((slot) => ({
              id: slot.id,
              kind: 'class' as const,
              start: PERIODS[periodIndex(slot.start_period)]?.start ?? '',
              end: PERIODS[periodIndex(slot.end_period)]?.end ?? '',
              title: slot.course,
              color: slot.color,
              meta: [
                slot.start_period === slot.end_period
                  ? t('agenda.period', { period: slot.start_period })
                  : t('agenda.periods', { start: slot.start_period, end: slot.end_period }),
                slot.location,
              ]
                .filter(Boolean)
                .join(' · '),
            }))
            // 節次表對不上的舊資料畫不出來
            .filter((item) => item.start && item.end),
          ...data.sessions
            .filter((session) => session.date === date)
            .map((session) => ({
              id: session.id,
              kind: 'session' as const,
              start: session.start_time.slice(0, 5),
              end: session.end_time.slice(0, 5),
              title: tPrograms(session.program),
              color: programColor(session.program),
              meta: session.location ?? '',
            })),
        ].sort((a, b) => a.start.localeCompare(b.start))
      : []

  const agenda = data && pickAgenda(today, now, itemsOn)
  const range = agenda && hourRange(agenda.items)
  // 收合時頂端對齊哪裡：今天是現在時間，其他天從第一件開始
  const topRem =
    agenda && range && agenda.date === today
      ? Math.max(0, ((minutesOf(now) - range.first * 60) / 60) * HOUR_REM)
      : 0
  const term = data && termProgress(today, data.semesters)

  const dayLabel = (date: string) => {
    const relative =
      date === today ? t('agenda.today') : date === shiftDate(today, 1) ? t('agenda.tomorrow') : null
    const full = format.dateTime(new Date(`${date}T12:00:00+08:00`), {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    })
    return relative ? `${relative} · ${full}` : full
  }

  const monthHours = data
    ? (sumHours(
        data.sessions
          .filter((session) => session.date.slice(0, 7) === today.slice(0, 7))
          .map((session) => ({ ...session, attendees: ['me'] })),
      ).get('me')?.capped ?? 0)
    : 0

  const summaries = data && {
    links: t('tools.links.summary', { count: data.clicks }),
    qr: t('tools.qr.summary', { count: data.qrCodes }),
    schedule: t('tools.schedule.summary', {
      count: itemsOn(today).filter((item) => item.kind === 'class').length,
    }),
    tutoring: t('tools.tutoring.summary', { hours: monthHours, cap: MONTHLY_CAP }),
  }

  return (
    <div className={style.home}>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {data ? (
        <div className={style.columns}>
          {agenda && range ? (
            <TimelineViewport
              className={style.panel}
              header={<h2 className={style.panelTitle}>{dayLabel(agenda.date)}</h2>}
              hours={range.last - range.first}
              topRem={topRem}
            >
              <DayTimeline items={agenda.items} now={agenda.date === today ? now : undefined} />
            </TimelineViewport>
          ) : (
            <section className={style.panel}>
              <h2 className={style.panelTitle}>{t('agenda.title')}</h2>
              <p className={style.hint}>{t('agenda.empty')}</p>
            </section>
          )}

          <section className={style.panel}>
            <h2 className={style.panelTitle}>{t('term.title')}</h2>
            {term?.kind === 'in' ? (
              <>
                <p className={style.termValue}>
                  {term.code} · {t('term.week', { week: term.week })}
                </p>
                <span className={style.termTrack}>
                  <span className={style.termFill} style={{ width: `${term.ratio * 100}%` }} />
                </span>
                <p className={style.hint}>
                  {t('term.left', { weeks: term.weeks, days: term.daysLeft })}
                </p>
                {term.exams.length > 0 && (
                  <ul className={style.exams}>
                    {term.exams.map((exam) => (
                      <li
                        key={exam.kind}
                        className={style.exam}
                        data-status={exam.status}
                      >
                        <span className={style.examName}>{t(`term.exam.${exam.kind}`)}</span>
                        <span className={style.examDates}>
                          {format.dateTimeRange(
                            new Date(`${exam.monday}T12:00:00+08:00`),
                            new Date(`${exam.friday}T12:00:00+08:00`),
                            { month: 'numeric', day: 'numeric' },
                          )}
                        </span>
                        <span className={style.examStatus}>
                          {t(`term.exam.${exam.status}`, { weeks: exam.weeksUntil, days: exam.daysUntil })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : term?.kind === 'before' ? (
              <p className={style.termValue}>
                {t('term.before', { code: term.code, days: term.daysUntil })}
              </p>
            ) : (
              <p className={style.hint}>{t('term.none')}</p>
            )}
          </section>
        </div>
      ) : (
        <p className={style.hint}>{t('loadError')}</p>
      )}

      <ul className={style.cards}>
        {TOOLS.map(({ href, key, icon }) => (
          <li key={key}>
            <Link href={href} className={style.card}>
              <Icon name={icon} className={style.cardIcon} />
              <span className={style.cardName}>{t(`tools.${key}.name`)}</span>
              <span className={style.cardDescription}>
                {summaries ? summaries[key] : t(`tools.${key}.description`)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
