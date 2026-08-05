'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/app/lib/supabase/client'
import { getPostsForAdmin } from '@/app/lib/supabase/posts'
import { getNotesForAdmin } from '@/app/lib/supabase/notes'
import Button from '@/app/components/admin/Button/Button'
import Icon from '@/app/components/Icon/Icon'
import { Link } from '@/i18n/navigation'
import style from './admin.module.scss'

/**
 * 後台總覽：內容統計 + 快速動作。導覽已移至側邊欄。
 */
export default function AdminPage() {
  const t = useTranslations('AdminPage.dashboard')
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    postsTotal: 0,
    postsPublished: 0,
    postsDraft: 0,
    notesTotal: 0,
  })

  useEffect(() => {
    const load = async () => {
      try {
        const [posts, notes] = await Promise.all([
          getPostsForAdmin(supabase, {}),
          getNotesForAdmin(supabase),
        ])
        setStats({
          postsTotal: posts.length,
          postsPublished: posts.filter((p) => p.status === 'published').length,
          postsDraft: posts.filter((p) => p.status === 'draft').length,
          notesTotal: notes.length,
        })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase])

  const cards = [
    { label: t('stats.totalPosts'), value: stats.postsTotal, icon: 'newspaper' as const },
    {
      label: t('stats.published'),
      value: stats.postsPublished,
      icon: 'gauge-high' as const,
    },
    { label: t('stats.draft'), value: stats.postsDraft, icon: 'folder' as const },
    { label: t('stats.totalNotes'), value: stats.notesTotal, icon: 'comment' as const },
  ]

  return (
    <div className={style.dashboard}>
      <header className={style.header}>
        <h1 className={style.title}>{t('title')}</h1>
        <p className={style.subtitle}>{t('subtitle')}</p>
      </header>

      <div className={style.stats}>
        {cards.map(({ label, value, icon }) => (
          <div key={label} className={style.statCard}>
            <div className={style.statIcon}>
              <Icon name={icon} size="sm" />
            </div>
            <div className={style.statValue}>{loading ? '—' : value}</div>
            <div className={style.statLabel}>{label}</div>
          </div>
        ))}
      </div>

      <section className={style.quickActions}>
        <h2 className={style.sectionTitle}>{t('quickActions')}</h2>
        <div className={style.actionRow}>
          <Link href="/admin/posts/new">
            <Button>{t('newPost')}</Button>
          </Link>
          <Link href="/admin/notes">
            <Button variant="secondary">{t('newNote')}</Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
