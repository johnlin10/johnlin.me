'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { createClient } from '@/app/lib/supabase/client'
import { getClicks, getShortLink, type Click, type ShortLink } from '@/app/lib/supabase/shortLinks'
import { SHORT_LINK_BASE } from '@/app/lib/siteConfigs'
import PageHeader from '@/app/components/admin/PageHeader/PageHeader'
import Button from '@/app/components/admin/Button/Button'
import { useToast } from '@/app/components/admin/Toast/ToastProvider'
import style from './detail.module.scss'

const DAYS = 90
const DAY = 86_400_000

type Bucket = { label: string; count: number }

/**
 * 依分組計數，多到少取前幾名。
 * @param clicks 點擊明細
 * @param groupOf 算出每筆點擊屬於哪一組
 * @param limit 取前幾名
 * @returns 分組和次數
 */
function topBuckets(clicks: Click[], groupOf: (click: Click) => string, limit = 8): Bucket[] {
  const counts = new Map<string, number>()
  for (const click of clicks) {
    const label = groupOf(click)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

/**
 * 橫向長條排行，長度以最大值為滿格。
 * @param props.buckets 分組和次數
 */
function BarList({ buckets }: { buckets: Bucket[] }) {
  const max = Math.max(...buckets.map((bucket) => bucket.count), 1)
  return (
    <ul className={style.barList}>
      {buckets.map(({ label, count }) => (
        <li key={label} className={style.barRow}>
          <span className={style.barLabel} title={label}>
            {label}
          </span>
          <span className={style.barTrack}>
            <span className={style.barFill} style={{ width: `${(count / max) * 100}%` }} />
          </span>
          <span className={style.barCount}>{count}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * 當地日期的比對用字串。
 * @param date 日期
 * @returns 年-月-日
 */
function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

export default function ShortLinkDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const t = useTranslations('ToolsPage.links')
  const format = useFormatter()
  const locale = useLocale()
  const toast = useToast()
  const supabase = useMemo(() => createClient(), [])
  const [link, setLink] = useState<ShortLink | null>(null)
  const [clicks, setClicks] = useState<Click[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getShortLink(supabase, slug), getClicks(supabase, slug, DAYS)])
      .then(([linkData, clickData]) => {
        setLink(linkData)
        setClicks(clickData)
      })
      .catch(() => toast.error(t('loadError')))
      .finally(() => setLoading(false))
  }, [supabase, slug])

  const regionNames = useMemo(
    () => new Intl.DisplayNames([locale === 'en' ? 'en' : 'zh-TW'], { type: 'region' }),
    [locale],
  )
  const regionName = (code: string | null) => {
    if (!code) return t('detail.unknown')
    try {
      return regionNames.of(code) ?? code
    } catch {
      return code
    }
  }

  const today = new Date()
  const days = Array.from(
    { length: DAYS },
    (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - (DAYS - 1 - i)),
  )
  const perDay = new Map<string, number>()
  for (const click of clicks) {
    const key = dayKey(new Date(click.clicked_at))
    perDay.set(key, (perDay.get(key) ?? 0) + 1)
  }
  const daily = days.map((date) => ({ date, count: perDay.get(dayKey(date)) ?? 0 }))
  const dailyMax = Math.max(...daily.map((day) => day.count), 1)
  const within = (n: number) =>
    clicks.filter((click) => Date.now() - new Date(click.clicked_at).getTime() < n * DAY).length
  const shortDate = (date: Date) => format.dateTime(date, { month: 'short', day: 'numeric' })

  const copy = async () => {
    const url = `${SHORT_LINK_BASE}/${slug}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t('copied', { url }))
    } catch {
      toast.error(t('copyError'))
    }
  }

  return (
    <div className={style.page}>
      <PageHeader
        title={slug}
        subtitle={link?.target_url}
        back={{ href: '/links', label: t('detail.back') }}
        action={
          link && (
            <Button variant="secondary" onClick={copy}>
              {t('copy')}
            </Button>
          )
        }
      />

      {loading ? (
        <p className={style.muted}>{t('loading')}</p>
      ) : !link ? (
        <p className={style.muted}>{t('detail.notFound')}</p>
      ) : (
        <>
          <div className={style.stats}>
            {[
              { label: t('detail.total'), value: link.clicks },
              { label: t('detail.last30'), value: within(30) },
              { label: t('detail.last7'), value: within(7) },
            ].map(({ label, value }) => (
              <div key={label} className={style.statCard}>
                <div className={style.statValue}>{format.number(value)}</div>
                <div className={style.statLabel}>{label}</div>
              </div>
            ))}
          </div>

          {clicks.length === 0 ? (
            <p className={style.muted}>{t('detail.noClicks')}</p>
          ) : (
            <>
              <section className={style.panel}>
                <h2 className={style.sectionTitle}>{t('detail.daily')}</h2>
                <ol className={style.columns}>
                  {daily.map(({ date, count }) => {
                    const label = `${shortDate(date)} · ${count}`
                    return (
                      <li key={date.getTime()} className={style.column} title={label} aria-label={label}>
                        <span
                          className={style.columnFill}
                          style={{ height: `${(count / dailyMax) * 100}%` }}
                        />
                      </li>
                    )
                  })}
                </ol>
                <div className={style.axis}>
                  <span>{shortDate(days[0])}</span>
                  <span>{shortDate(days[DAYS - 1])}</span>
                </div>
              </section>

              <div className={style.pair}>
                <section className={style.panel}>
                  <h2 className={style.sectionTitle}>{t('detail.referrers')}</h2>
                  <BarList
                    buckets={topBuckets(clicks, (click) => click.referrer_host ?? t('detail.direct'))}
                  />
                </section>
                <section className={style.panel}>
                  <h2 className={style.sectionTitle}>{t('detail.countries')}</h2>
                  <BarList buckets={topBuckets(clicks, (click) => regionName(click.country))} />
                </section>
              </div>
            </>
          )}

          <p className={style.footnote}>{t('detail.footnote')}</p>
        </>
      )}
    </div>
  )
}
