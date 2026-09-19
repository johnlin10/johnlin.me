'use client'

import { useLayoutEffect, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import Icon, { type IconName } from '@/app/components/Icon/Icon'
import style from './PostList.module.scss'

export type BlogView = 'card' | 'list'

const PREFERS_LIST = /(?:^|; )blog-view=list(?:;|$)/

// 頁面是共用快取，伺服器不讀 cookie：硬載入時由這段在卡片畫出來前設好版型
const APPLY_VIEW = `if(${PREFERS_LIST}.test(document.cookie))document.currentScript.parentElement.dataset.view='list'`

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
export default function PostList({ children }: { children: ReactNode }) {
  const [view, setView] = useState<BlogView>('card')
  const t = useTranslations('BlogPage.viewMode')

  // 站內導覽時上面那段 script 不會執行，改在畫面顯示前讀
  useLayoutEffect(() => {
    if (PREFERS_LIST.test(document.cookie)) setView('list')
  }, [])

  const handleChange = (next: BlogView) => {
    setView(next)
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

      <div className={style.list} data-view={view} suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: APPLY_VIEW }} />
        {children}
      </div>
    </>
  )
}
