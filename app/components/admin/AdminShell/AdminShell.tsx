'use client'

import { useEffect, useRef, useState } from 'react'
import { useSelectedLayoutSegments } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter, Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { SITE_CONFIG } from '@/app/lib/siteConfigs'
import { createClient } from '@/app/lib/supabase/client'
import Icon, { type IconName } from '@/app/components/Icon/Icon'
import ThemeToggle from '@/app/components/ThemeToggle/ThemeToggle'
import LanguageSwitch from '@/app/components/LanguageSwitch/LanguageSwitch'
import Popover from '@/app/components/admin/Popover/Popover'
import { useConfirm } from '@/app/components/admin/ConfirmDialog/ConfirmDialog'
import { isFullscreenAdminRoute } from './fullscreenRoutes'
import {
  AdminPageHeaderProvider,
  useAdminPageHeaderSlot,
} from './AdminPageHeaderContext'
import style from './AdminShell.module.scss'

/**
 * 導覽分組：內容本身（文章／短文／攝影）和整理內容的工具（分類／系列／
 * 標籤）性質不同，分開兩組。工具組再用 scopeKey 標出服務範圍——分類、
 * 系列只服務文章，標籤是跨內容型別的，光看名字看不出來。
 */
const NAV_GROUPS: {
  labelKey?: string
  items: {
    href: string
    labelKey: string
    icon: IconName
    scopeKey?: string
  }[]
}[] = [
  {
    items: [{ href: '/', labelKey: 'dashboard', icon: 'gauge-high' }],
  },
  {
    labelKey: 'groups.content',
    items: [
      { href: '/posts', labelKey: 'posts', icon: 'newspaper' },
      { href: '/notes', labelKey: 'notes', icon: 'comment' },
      { href: '/photos', labelKey: 'photos', icon: 'camera' },
    ],
  },
  {
    labelKey: 'groups.taxonomy',
    items: [
      {
        href: '/categories',
        labelKey: 'categories',
        icon: 'folder',
        scopeKey: 'scopes.posts',
      },
      {
        href: '/series',
        labelKey: 'series',
        icon: 'layer-group',
        scopeKey: 'scopes.posts',
      },
      {
        href: '/tags',
        labelKey: 'tags',
        icon: 'tag',
        scopeKey: 'scopes.all',
      },
    ],
  },
]

const DESKTOP_BREAKPOINT = 1025

/**
 * PageHeader 的兩個掛載點（主列／副列各一個，理由見
 * AdminPageHeaderContext.tsx 的註解）。都是 .main 的直接子節點，
 * 手機／平板／桌機共用，寬度自然跟著 .main 走（手機下側邊欄變成
 * 覆蓋式抽屜，.main 本來就是滿版）。sticky／固定列高／z-index 都
 * 交給 PageHeader 自己的 CSS 處理，這裡只單純提供掛載點。
 */
function HeaderSlotMount() {
  const { setMainSlot, setSubSlot } = useAdminPageHeaderSlot()
  return (
    <>
      <div ref={setMainSlot} className={style.headerMainSlot} />
      <div ref={setSubSlot} className={style.headerSubSlot} />
    </>
  )
}

interface UserProfile {
  email: string | null
  name: string | null
  avatarUrl: string | null
}

/**
 * 後台外殼：左側固定側邊欄（行動裝置收合為抽屜）＋ 使用者資訊／登出。
 * 登入頁不套用外殼，維持獨立的置中版面。
 */
export default function AdminShell({
  children,
}: {
  children: React.ReactNode
}) {
  const t = useTranslations('AdminPage.shell')
  const tNav = useTranslations('AdminPage.nav')
  const locale = useLocale()
  // 以後台為根的路徑（/posts/<id>/write）。不用 usePathname：子網域靠 proxy 改寫，
  // 預先渲染時看到的是 /admin/...，瀏覽器網址沒有，兩邊會對不上。
  const pathname = `/${useSelectedLayoutSegments().join('/')}`
  const router = useRouter()
  const confirm = useConfirm()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsAnchorRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user
      if (user) {
        const meta = user.user_metadata || {}
        const name =
          meta.full_name ||
          meta.name ||
          user.email?.split('@')[0] ||
          t('defaultUserName')
        const avatarUrl = meta.avatar_url || meta.picture || null
        setUserProfile({
          email: user.email ?? null,
          name,
          avatarUrl,
        })
      }
    })
  }, [])

  useEffect(() => {
    setDrawerOpen(false)
    setSettingsOpen(false)
  }, [pathname])

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= DESKTOP_BREAKPOINT) setDrawerOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (pathname === '/login' || isFullscreenAdminRoute(pathname)) {
    return <>{children}</>
  }

  const toggleDrawer = () => setDrawerOpen((v) => !v)

  const handleSignOut = async () => {
    const ok = await confirm({
      title: t('signOutConfirm.title'),
      message: t('signOutConfirm.message'),
    })
    if (!ok) return
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <AdminPageHeaderProvider drawerOpen={drawerOpen} toggleDrawer={toggleDrawer}>
      {/* data-admin-shell：globals.scss 靠這個屬性用 :has() 鎖住文件層的
          捲動／回彈，只在後台外殼掛載時生效，見那邊的註解。 */}
      <div className={style.shell} data-admin-shell>
        {drawerOpen && (
          <div
            className={style.scrim}
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
        )}

        <aside className={`${style.sidebar} ${drawerOpen ? style.open : ''}`}>
          <div className={style.sidebarHeader}>
            {/* 主站在另一個網域，用一般連結。 */}
            <a
              href={
                locale === routing.defaultLocale
                  ? SITE_CONFIG.url
                  : `${SITE_CONFIG.url}/${locale}`
              }
              className={style.backHomeButton}
            >
              <Icon name="home" size="sm" />
              <span>{t('backToHome')}</span>
            </a>

            <Link href="/" className={style.brand}>
              <span className={style.brandMark}>John Lin</span>
              <span className={style.brandSub}>{t('brandSubtitle')}</span>
            </Link>
          </div>

          <nav className={style.nav} aria-label={t('navAriaLabel')}>
            {NAV_GROUPS.map((group, groupIndex) => (
              <div key={group.labelKey ?? groupIndex} className={style.navGroup}>
                {group.labelKey && (
                  <span className={style.navGroupLabel}>
                    {tNav(group.labelKey)}
                  </span>
                )}
                {group.items.map(({ href, labelKey, icon, scopeKey }) => {
                  const active =
                    href === '/'
                      ? pathname === '/'
                      : pathname.startsWith(href)
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`${style.navLink} ${active ? style.active : ''}`}
                    >
                      <Icon name={icon} size="sm" />
                      <span>{tNav(labelKey)}</span>
                      {scopeKey && (
                        <span className={style.navScope}>{tNav(scopeKey)}</span>
                      )}
                    </Link>
                  )
                })}
              </div>
            ))}
          </nav>

          <div className={style.userArea}>
            <div className={style.userCard}>
              <div className={style.avatarWrapper}>
                {userProfile?.avatarUrl ? (
                  <img
                    src={userProfile.avatarUrl}
                    alt={userProfile.name ?? t('userAvatarAlt')}
                    className={style.avatarImage}
                  />
                ) : (
                  <div className={style.avatarFallback}>
                    {userProfile?.name ? (
                      userProfile.name.charAt(0).toUpperCase()
                    ) : (
                      <Icon name="user" size="sm" />
                    )}
                  </div>
                )}
              </div>

              <div className={style.userInfo}>
                <span className={style.userName} title={userProfile?.name ?? ''}>
                  {userProfile?.name ?? t('defaultUserName')}
                </span>
                <span
                  className={style.userEmail}
                  title={userProfile?.email ?? ''}
                >
                  {userProfile?.email ?? ''}
                </span>
              </div>

              {/* 主題／語言收在一顆齒輪後面：這兩個都是「設定一次就不太
                  會再動」的偏好，不值得長期佔著這排的寬度——原本
                  ThemeToggle 帶著文字標籤攤在這裡，把名字和 email 擠到
                  只剩兩三個字。 */}
              <button
                ref={settingsAnchorRef}
                type="button"
                className={style.settingsButton}
                onClick={() => setSettingsOpen((v) => !v)}
                aria-label={t('preferences')}
                aria-expanded={settingsOpen}
                title={t('preferences')}
              >
                <Icon name="gear" size="sm" />
              </button>
            </div>

            <Popover
              isOpen={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              anchorRef={settingsAnchorRef}
              title={t('preferences')}
              width={248}
            >
              <div className={style.prefRow}>
                <span className={style.prefLabel}>{t('themeLabel')}</span>
                <ThemeToggle />
              </div>
              <div className={style.prefRow}>
                <span className={style.prefLabel}>{t('languageLabel')}</span>
                <LanguageSwitch />
              </div>
            </Popover>

            <button
              type="button"
              className={style.signOut}
              onClick={handleSignOut}
            >
              <Icon name="right-from-bracket" size="sm" />
              <span>{t('signOut')}</span>
            </button>
          </div>
        </aside>

        <div className={style.main}>
          <HeaderSlotMount />
          <div className={style.page}>{children}</div>
        </div>
      </div>
    </AdminPageHeaderProvider>
  )
}
