'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter, Link } from '@/i18n/navigation'
import { createClient } from '@/app/lib/supabase/client'
import Icon, { type IconName } from '@/app/components/Icon/Icon'
import ThemeToggle from '@/app/components/ThemeToggle/ThemeToggle'
import { useConfirm } from '@/app/components/admin/ConfirmDialog/ConfirmDialog'
import { isFullscreenAdminRoute } from './fullscreenRoutes'
import {
  AdminPageHeaderProvider,
  useAdminPageHeaderSlot,
} from './AdminPageHeaderContext'
import style from './AdminShell.module.scss'

const NAV_ITEMS: { href: string; labelKey: string; icon: IconName }[] = [
  { href: '/admin', labelKey: 'dashboard', icon: 'gauge-high' },
  { href: '/admin/posts', labelKey: 'posts', icon: 'newspaper' },
  { href: '/admin/notes', labelKey: 'notes', icon: 'comment' },
  { href: '/admin/photos', labelKey: 'photos', icon: 'camera' },
  { href: '/admin/categories', labelKey: 'categories', icon: 'folder' },
  { href: '/admin/tags', labelKey: 'tags', icon: 'tag' },
  { href: '/admin/series', labelKey: 'series', icon: 'layer-group' },
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
  const pathname = usePathname()
  const router = useRouter()
  const confirm = useConfirm()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

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
  }, [pathname])

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= DESKTOP_BREAKPOINT) setDrawerOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (pathname === '/admin/login' || isFullscreenAdminRoute(pathname)) {
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
    router.push('/admin/login')
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
            <Link href="/" className={style.backHomeButton}>
              <Icon name="home" size="sm" />
              <span>{t('backToHome')}</span>
            </Link>

            <Link href="/admin" className={style.brand}>
              <span className={style.brandMark}>John Lin</span>
              <span className={style.brandSub}>{t('brandSubtitle')}</span>
            </Link>
          </div>

          <nav className={style.nav} aria-label={t('navAriaLabel')}>
            {NAV_ITEMS.map(({ href, labelKey, icon }) => {
              const active =
                href === '/admin'
                  ? pathname === '/admin'
                  : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`${style.navLink} ${active ? style.active : ''}`}
                >
                  <Icon name={icon} size="sm" />
                  <span>{tNav(labelKey)}</span>
                </Link>
              )
            })}
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

              <ThemeToggle />
            </div>

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
