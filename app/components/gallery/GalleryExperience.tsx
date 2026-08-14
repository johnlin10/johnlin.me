'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import type { Photo } from '@/app/types/photo'
import type { SupportedLocale } from '@/app/types/blog'
import PageContainer from '@/app/components/PageContainer/PageContainer'
import PageHeader from '@/app/components/PageHeader/PageHeader'
import GalleryWall from './GalleryWall/GalleryWall'
import GalleryModeToggle, {
  type GalleryViewMode,
} from './GalleryWall/GalleryModeToggle'
import JustifiedList from './GalleryList/JustifiedList'
import styles from './GalleryWall/GalleryWall.module.scss'

interface GalleryExperienceProps {
  photos: Photo[]
  locale: SupportedLocale
  /** SSR 版面（PageContainer＋PageHeader＋GalleryList 全包好），只在掛載前／
   *  無 JS／零照片時使用；掛載後的清單模式改用 JustifiedList（見下）。 */
  fallback: ReactNode
}

const MODE_STORAGE_KEY = 'gallery:view-mode'

/**
 * 有照片且有 JS → 預設升級成可自由探索的互動牆（含手機觸控：拖曳＋慣性＋捏合）。
 * 使用者可切到「清單模式」，偏好記在 localStorage。掛載前一律回 fallback（與
 * SSR 一致避免 hydration 不匹配）；掛載後選清單才換成 JustifiedList——那是
 * 需要量測容器寬度才能精算的齊行版面，SSR／no-JS 版走的是簡化過、不需要 JS
 * 的 GalleryList（包在 fallback 裡）。no-JS／爬蟲永遠只會拿到 fallback。
 */
export default function GalleryExperience({
  photos,
  locale,
  fallback,
}: GalleryExperienceProps) {
  const t = useTranslations('GalleryPage')
  const [mounted, setMounted] = useState(false)
  const [mode, setMode] = useState<GalleryViewMode>('wall')

  useEffect(() => {
    let saved: string | null = null
    try {
      saved = localStorage.getItem(MODE_STORAGE_KEY)
    } catch {
      // localStorage 被隱私模式擋掉時退回預設，不擋渲染
    }
    if (saved === 'list' || saved === 'wall') setMode(saved)
    setMounted(true)
  }, [])

  const changeMode = (next: GalleryViewMode) => {
    setMode(next)
    try {
      localStorage.setItem(MODE_STORAGE_KEY, next)
    } catch {
      // 同上，寫不進去就算了
    }
  }

  if (!mounted || photos.length === 0) {
    return <>{fallback}</>
  }

  if (mode === 'list') {
    return (
      <>
        <PageContainer maxWidth="wide">
          <PageHeader
            size="md"
            title={t('page_title')}
            lead={t('description')}
          />
          <JustifiedList photos={photos} locale={locale} />
        </PageContainer>
        <div className={styles.modeDock}>
          <GalleryModeToggle mode={mode} onChange={changeMode} />
        </div>
      </>
    )
  }

  return (
    <GalleryWall
      photos={photos}
      locale={locale}
      mode={mode}
      onModeChange={changeMode}
    />
  )
}
