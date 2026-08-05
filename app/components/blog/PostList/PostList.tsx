'use client'

import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import Icon, { type IconName } from '@/app/components/Icon/Icon'
import style from './PostList.module.scss'

export type BlogView = 'card' | 'list'

const VIEWS: { value: BlogView; icon: IconName }[] = [
  { value: 'card', icon: 'table-cells-large' },
  { value: 'list', icon: 'list' },
]

/**
 * 文章列表容器 + 視圖切換。
 *
 * 卡片本身仍然是伺服器元件，用 children 傳進來（RSC 合法用法），
 * 這裡只負責換容器的 data-view，版型全交給 CSS。
 */
export default function PostList({
  initialView,
  children,
}: {
  initialView: BlogView
  children: ReactNode
}) {
  const [view, setView] = useState<BlogView>(initialView)
  const t = useTranslations('BlogPage.viewMode')

  const handleChange = (next: BlogView) => {
    setView(next)
    // 存 cookie 是為了讓下一次 SSR 就吐出正確版型（不會閃）；
    // 當下畫面直接由 state 更新，不呼叫 router.refresh()，免得重打一次資料。
    document.cookie = `blog-view=${next};path=/;max-age=31536000;samesite=lax`
  }

  return (
    <>
      <div className={style.toolbar}>
        <div className={style.switch} role="group" aria-label={t('label')}>
          {VIEWS.map(({ value, icon }) => (
            <button
              key={value}
              type="button"
              className={style.option}
              aria-pressed={view === value}
              aria-label={t(value)}
              title={t(value)}
              onClick={() => handleChange(value)}
            >
              <Icon name={icon} size="sm" />
            </button>
          ))}
        </div>
      </div>

      <div className={style.list} data-view={view}>
        {children}
      </div>
    </>
  )
}
