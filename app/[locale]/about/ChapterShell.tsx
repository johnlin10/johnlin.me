'use client'

import { useCallback, useRef, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import HeaderSubNav from '@/app/components/Header/HeaderSubNav'
import style from './about.module.scss'

type ChapterMeta = {
  id: string
  title: string
}

type Props = {
  chapters: ChapterMeta[]
  panels: ReactNode[] // 與 chapters 同序，皆為 server 端渲染好的內容
  initialChapterId: string
  sidebar: ReactNode
  pageTitle: string
  navLabel: string
}

// --header-height(72) + 呼吸空間；手機/平板還要蓋過 portal 進 Header 的
// 章節次導覽列高度（見 HeaderSubNav），所以留得比純 header 高一些。
const HEADER_OFFSET = 132

/**
 * About 頁章節切換器。所有章節皆由 server 渲染進 HTML（SEO），
 * 這裡只負責用 class + motion 做「只顯示作用中章節」的淡入淡出＋縮放，
 * 並把目前章節反映在網址 query param 上（淺層更新，不觸發 RSC round-trip）。
 */
export default function ChapterShell({
  chapters,
  panels,
  initialChapterId,
  sidebar,
  pageTitle,
  navLabel,
}: Props) {
  const reduce = useReducedMotion()
  const [active, setActive] = useState(initialChapterId)
  const stageRef = useRef<HTMLDivElement>(null)
  // 手機/平板（橫向捲動 pill）與桌機（sidebar 直排清單）各自獨立渲染一份導覽
  // （見下方 renderTabs），key 用 "variant:id" 區分，避免兩份 ref 互相覆蓋。
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const select = useCallback(
    (id: string) => {
      if (id === active) return
      setActive(id)

      const url = new URL(window.location.href)
      if (id === chapters[0]?.id) {
        url.searchParams.delete('chapter')
      } else {
        url.searchParams.set('chapter', id)
      }
      window.history.replaceState(null, '', url)

      // 只有舞台頂端已捲出視窗才拉回，避免無謂跳動
      const top = stageRef.current?.getBoundingClientRect().top ?? 0
      if (top < HEADER_OFFSET) {
        const distance = Math.abs(top - HEADER_OFFSET)
        const far = distance > window.innerHeight * 1.5
        window.scrollTo({
          top: window.scrollY + top - HEADER_OFFSET,
          behavior: reduce || far ? 'auto' : 'smooth',
        })
      }
    },
    [active, chapters, reduce],
  )

  const makeKeyDownHandler =
    (variant: 'mobile' | 'desktop') =>
    (e: React.KeyboardEvent<HTMLElement>) => {
      const i = chapters.findIndex((c) => c.id === active)
      const n = chapters.length
      let next: number

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          next = (i + 1) % n
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          next = (i - 1 + n) % n
          break
        case 'Home':
          next = 0
          break
        case 'End':
          next = n - 1
          break
        default:
          return
      }

      e.preventDefault()
      const id = chapters[next].id
      select(id)
      tabRefs.current[`${variant}:${id}`]?.focus()
    }

  // 同一份 tab 清單，依 variant 渲染成手機/平板的橫向捲動列，或桌機 sidebar 直排清單；
  // 兩者用不同 id 前綴，同一時間只有一份透過 CSS 顯示（另一份 display:none，
  // 完全退出無障礙樹），不會有重複 role="tab" id 同時暴露的問題。
  const renderTabs = (variant: 'mobile' | 'desktop') => (
    <nav
      className={
        variant === 'mobile' ? style.chapterNavMobile : style.chapterNavDesktop
      }
      role="tablist"
      aria-label={navLabel}
      onKeyDown={makeKeyDownHandler(variant)}
    >
      {chapters.map((c) => {
        const isActive = c.id === active
        return (
          <button
            key={c.id}
            ref={(el) => {
              tabRefs.current[`${variant}:${c.id}`] = el
            }}
            type="button"
            role="tab"
            id={`chapter-tab-${variant}-${c.id}`}
            aria-controls={`chapter-panel-${c.id}`}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className={`${style.chapterTab} ${
              isActive ? style.chapterTabActive : ''
            }`}
            onClick={() => select(c.id)}
          >
            {c.title}
          </button>
        )
      })}
    </nav>
  )

  return (
    <div className={style.layout}>
      <aside className={style.sidebar}>
        {sidebar}
        {renderTabs('desktop')}
      </aside>

      <HeaderSubNav>{renderTabs('mobile')}</HeaderSubNav>

      <div className={style.stage} ref={stageRef}>
        <h1 className={style.srOnly}>{pageTitle}</h1>

        {chapters.map((c, i) => {
          const isActive = c.id === active
          return (
            <motion.div
              key={c.id}
              id={`chapter-panel-${c.id}`}
              role="tabpanel"
              aria-labelledby={`chapter-tab-mobile-${c.id} chapter-tab-desktop-${c.id}`}
              tabIndex={isActive ? 0 : -1}
              inert={!isActive}
              className={`${style.panel} ${isActive ? style.panelActive : ''}`}
              initial={false}
              animate={{
                opacity: isActive ? 1 : 0,
                scale: isActive || reduce ? 1 : 0.95,
              }}
              transition={{
                duration: reduce ? 0.01 : isActive ? 0.5 : 0.3,
                ease: [0.23, 1, 0.32, 1],
              }}
            >
              {panels[i]}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
