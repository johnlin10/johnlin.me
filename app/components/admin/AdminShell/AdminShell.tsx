'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter, Link } from '@/i18n/navigation'
import { createClient } from '@/app/lib/supabase/client'
import Icon, { type IconName } from '@/app/components/Icon/Icon'
import ThemeToggle from '@/app/components/ThemeToggle/ThemeToggle'
import { useConfirm } from '@/app/components/admin/ConfirmDialog/ConfirmDialog'
import { isFullscreenAdminRoute } from './fullscreenRoutes'
import style from './AdminShell.module.scss'

const NAV_ITEMS: { href: string; labelKey: string; icon: IconName }[] = [
  { href: '/admin', labelKey: 'dashboard', icon: 'gauge-high' },
  { href: '/admin/posts', labelKey: 'posts', icon: 'newspaper' },
  { href: '/admin/notes', labelKey: 'notes', icon: 'comment' },
  { href: '/admin/categories', labelKey: 'categories', icon: 'folder' },
  { href: '/admin/tags', labelKey: 'tags', icon: 'tag' },
  { href: '/admin/series', labelKey: 'series', icon: 'layer-group' },
]

const DESKTOP_BREAKPOINT = 1025

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

  const currentItem = NAV_ITEMS.find(({ href }) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
  )

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
    <div className={style.shell}>
      <div className={style.topbar}>
        <button
          type="button"
          className={style.menuToggle}
          onClick={() => setDrawerOpen((v) => !v)}
          aria-label={drawerOpen ? t('menuClose') : t('menuOpen')}
          aria-expanded={drawerOpen}
        >
          <Icon name={drawerOpen ? 'xmark' : 'bars'} size="lg" />
        </button>
        <span className={style.topbarTitle}>
          {currentItem ? tNav(currentItem.labelKey) : t('topbarFallback')}
        </span>
      </div>

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
        <div className={style.page}>{children}</div>
      </div>
    </div>
  )
}
