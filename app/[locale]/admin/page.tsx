'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations, useFormatter } from 'next-intl'
import { createClient } from '@/app/lib/supabase/client'
import {
  getDashboardData,
  type Bucket,
  type DashboardData,
} from '@/app/lib/supabase/dashboard'
import Button from '@/app/components/admin/Button/Button'
import PageHeader from '@/app/components/admin/PageHeader/PageHeader'
import Icon, { type IconName } from '@/app/components/Icon/Icon'
import { Link } from '@/i18n/navigation'
import style from './admin.module.scss'

/** 長條圖：最大值撐滿，其餘按比例。全零時不畫，避免除以零。 */
function BarRow({ buckets, max }: { buckets: Bucket[]; max: number }) {
  return (
    <ul className={style.barList}>
      {buckets.map(({ label, count }) => (
        <li key={label} className={style.barRow}>
          <span className={style.barLabel} title={label}>
            {label}
          </span>
          <span className={style.barTrack}>
            <span
              className={style.barFill}
              style={{ width: max > 0 ? `${(count / max) * 100}%` : 0 }}
            />
          </span>
          <span className={style.barCount}>{count}</span>
        </li>
      ))}
    </ul>
  )
}

const ACTIVITY_ICON: Record<string, IconName> = {
  post: 'newspaper',
  note: 'comment',
  photo: 'camera',
}

export default function AdminPage() {
  const t = useTranslations('AdminPage.dashboard')
  const format = useFormatter()
  const supabase = useMemo(() => createClient(), [])
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboardData(supabase)
      .then(setData)
      .catch((error) => console.error('總覽資料載入失敗:', error))
      .finally(() => setLoading(false))
  }, [supabase])

  const dash = loading || !data ? null : data

  const cards = [
    {
      icon: 'check' as const,
      value: dash?.totals.published,
      label: t('stats.published'),
      hint: t('stats.publishedHint'),
    },
    {
      icon: 'newspaper' as const,
      value: dash && dash.totals.postChars + dash.totals.noteChars,
      label: t('stats.chars'),
      hint: t('stats.charsHint'),
    },
    {
      icon: 'camera' as const,
      value: dash?.totals.photos,
      label: t('stats.photos'),
      hint: dash ? t('stats.photosHint', { years: dash.totals.photoYearSpan }) : '',
    },
    {
      icon: 'eye' as const,
      value: dash?.totals.views,
      label: t('stats.views'),
      hint: dash ? t('stats.viewsHint', { count: dash.totals.viewsRecent }) : '',
    },
  ]

  const gapItems = dash
    ? ([
        ['missingEnglish', dash.gaps.missingEnglish, '/posts'],
        ['staleDrafts', dash.gaps.staleDrafts, '/posts'],
        ['photosWithoutCaption', dash.gaps.photosWithoutCaption, '/photos'],
        ['photosWithoutLocation', dash.gaps.photosWithoutLocation, '/photos'],
      ] as const).filter(([, count]) => count > 0)
    : []

  return (
    <div className={style.dashboard}>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <Link href="/posts/new">
            <Button>{t('newPost')}</Button>
          </Link>
        }
      />

      <div className={style.stats}>
        {cards.map(({ icon, value, label, hint }) => (
          <div key={label} className={style.statCard}>
            <div className={style.statIcon}>
              <Icon name={icon} size="sm" />
            </div>
            <div className={style.statValue}>
              {value === undefined || value === null ? '—' : format.number(value)}
            </div>
            <div className={style.statLabel}>{label}</div>
            {hint && <div className={style.statHint}>{hint}</div>}
          </div>
        ))}
      </div>

      {gapItems.length > 0 && (
        <div className={style.gapBar}>
          <Icon name="triangle-exclamation" size="sm" />
          <div className={style.gapItems}>
            {gapItems.map(([key, count, href]) => (
              <Link key={key} href={href} className={style.gapItem}>
                {t(`gaps.${key}`, { count })}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className={style.columns}>
        <section className={style.panel}>
          <h2 className={style.sectionTitle}>{t('topPosts.title')}</h2>
          {dash && dash.topPosts.length > 0 ? (
            <ul className={style.rankList}>
              {dash.topPosts.map((post) => (
                <li key={post.id}>
                  <Link href={`/posts/${post.id}`} className={style.rankRow}>
                    <span className={style.rankTitle}>{post.title}</span>
                    <span className={style.rankTrack}>
                      <span
                        className={style.rankFill}
                        style={{
                          width: `${(post.views / Math.max(...dash.topPosts.map((p) => p.views), 1)) * 100}%`,
                        }}
                      />
                    </span>
                    <span className={style.rankValue}>
                      {format.number(post.views)}
                      {post.viewsRecent > 0 && (
                        <span className={style.rankDelta}>+{post.viewsRecent}</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={style.empty}>{loading ? t('loading') : t('topPosts.empty')}</p>
          )}
          <p className={style.footnote}>
            {dash?.trendSince
              ? t('topPosts.since', { date: dash.trendSince })
              : t('topPosts.noTrendYet')}
          </p>
        </section>

        <section className={style.panel}>
          <h2 className={style.sectionTitle}>{t('activity.title')}</h2>
          {dash && dash.activity.length > 0 ? (
            <ol className={style.timeline}>
              {dash.activity.map((item, index) => (
                <li key={`${item.kind}-${item.at}-${index}`} className={style.timelineItem}>
                  <span className={style.timelineDot}>
                    <Icon name={ACTIVITY_ICON[item.kind]} size="xs" />
                  </span>
                  <Link href={item.href} className={style.timelineBody}>
                    <span className={style.timelineTitle}>
                      {item.groupCount
                        ? t('activity.photoBatch', { count: item.groupCount })
                        : item.title}
                    </span>
                    <span className={style.timelineDate}>
                      {/* 只有跨年的項目才印年份——你有把舊文的 published_at
                          回填到前一年，不印年份會讀成今年的日期。 */}
                      {format.dateTime(new Date(item.at), {
                        year:
                          new Date(item.at).getFullYear() === new Date().getFullYear()
                            ? undefined
                            : 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className={style.empty}>{loading ? t('loading') : t('activity.empty')}</p>
          )}
        </section>
      </div>

      <section className={style.panel}>
        <h2 className={style.sectionTitle}>{t('photoArchive.title')}</h2>
        {dash && dash.cameras.length > 0 ? (
          <div className={style.chartGrid}>
            <div className={style.chart}>
              <h3 className={style.chartTitle}>{t('photoArchive.cameras')}</h3>
              <BarRow
                buckets={dash.cameras}
                max={Math.max(...dash.cameras.map((c) => c.count))}
              />
            </div>
            <div className={style.chart}>
              <h3 className={style.chartTitle}>{t('photoArchive.focal')}</h3>
              <BarRow
                buckets={dash.focalLengths}
                max={Math.max(...dash.focalLengths.map((f) => f.count))}
              />
            </div>
            <div className={style.chart}>
              <h3 className={style.chartTitle}>{t('photoArchive.years')}</h3>
              <BarRow
                buckets={dash.photoYears}
                max={Math.max(...dash.photoYears.map((y) => y.count))}
              />
            </div>
          </div>
        ) : (
          <p className={style.empty}>
            {loading ? t('loading') : t('photoArchive.empty')}
          </p>
        )}
      </section>
    </div>
  )
}
