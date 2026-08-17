'use client'

import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { useAdminPageHeaderSlot } from '@/app/components/admin/AdminShell/AdminPageHeaderContext'
import Icon from '@/app/components/Icon/Icon'
import style from './PageHeader.module.scss'

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  subbar?: ReactNode
  /**
   * 第二層頁面（例如上傳預檢表）用來取代漢堡選單的返回連結，顯示在
   * 標題左側。href 是列表頁路徑，label 供螢幕閱讀器使用。
   */
  back?: { href: string; label: string }
}

/**
 * 後台頁面共用的頂部控制欄：標題／副標題／單一主要操作按鈕整合成一列
 * （只放一顆——次要功能按鈕請放進頁面內容區頂部，不要塞進這裡），
 * 標籤切換／篩選器等附屬功能放進下方的副控制欄。
 *
 * 手機／平板／桌機共用同一套結構，只靠 CSS 依斷點調整樣式：手機下這
 * 一列同時取代了 AdminShell 原本自己畫的漢堡選單 topbar（見這裡的
 * menuToggle），不再讓兩層標題同時出現。
 *
 * 主列／副列分別 portal 進 AdminShell 提供的兩個獨立掛載點（不是同一
 * 個），理由見 AdminPageHeaderContext.tsx 的註解：兩者都要各自
 * position:sticky 且各自比較 z-index（主列要蓋過 photos 頁的 inspector
 * 側欄、副列要被它蓋過），包在同一個掛載點裡會被同一個 stacking
 * context 框住，沒辦法分開比較。掛載點還沒 mount 的那一瞬間（SSR／
 * 首次繪製）先內嵌渲染在頁面內容裡，避免整段空白。
 *
 * 主列／副列的高度都是 _tokens.scss 裡的固定常數（--admin-header-height
 * ／--admin-subbar-height），不隨內容多寡變動——這樣任何需要「讓開控制
 * 欄」的元件（例如 photos 頁的 inspector 側欄）都能直接用常數算 sticky
 * 偏移，不必動態量測。因此標題／副標題一律單行截斷，不換行。
 */
export default function PageHeader({
  title,
  subtitle,
  action,
  subbar,
  back,
}: PageHeaderProps) {
  const t = useTranslations('AdminPage.shell')
  const { mainSlot, subSlot, drawerOpen, toggleDrawer } =
    useAdminPageHeaderSlot()

  const mainBar = (
    <div className={style.mainBar}>
      {back ? (
        <Link href={back.href} className={style.backButton} aria-label={back.label}>
          <Icon name="arrow-left" size="lg" />
        </Link>
      ) : (
        <button
          type="button"
          className={style.menuToggle}
          onClick={toggleDrawer}
          aria-label={drawerOpen ? t('menuClose') : t('menuOpen')}
          aria-expanded={drawerOpen}
        >
          <Icon name={drawerOpen ? 'xmark' : 'bars'} size="lg" />
        </button>
      )}
      <div className={style.titleSection}>
        <h1 className={style.title}>{title}</h1>
        {subtitle && <p className={style.subtitle}>{subtitle}</p>}
      </div>
      {action && <div className={style.action}>{action}</div>}
    </div>
  )

  const subBar = subbar ? <div className={style.subBar}>{subbar}</div> : null

  return (
    <>
      {mainSlot ? createPortal(mainBar, mainSlot) : mainBar}
      {subBar && (subSlot ? createPortal(subBar, subSlot) : subBar)}
    </>
  )
}
