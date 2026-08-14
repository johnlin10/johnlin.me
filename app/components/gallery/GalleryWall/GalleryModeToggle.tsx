'use client'

import { useTranslations } from 'next-intl'
import Icon from '@/app/components/Icon/Icon'
import styles from './GalleryWall.module.scss'

export type GalleryViewMode = 'wall' | 'list'

interface GalleryModeToggleProps {
  mode: GalleryViewMode
  onChange: (mode: GalleryViewMode) => void
}

/**
 * 牆 ↔ 清單檢視切換（分段控制）。手機上「自由探索的牆」不是每個人都習慣，
 * 給一條退路切回可捲動的語意化清單；桌機也一致提供。偏好記在 localStorage，
 * 狀態與持久化在 GalleryExperience，這裡只是呈現。
 */
export default function GalleryModeToggle({
  mode,
  onChange,
}: GalleryModeToggleProps) {
  const t = useTranslations('GalleryPage.mode')
  return (
    <div className={styles.modeToggle} role="group" aria-label={t('label')}>
      <button
        type="button"
        className={styles.modeButton}
        data-active={mode === 'wall'}
        aria-pressed={mode === 'wall'}
        onClick={() => onChange('wall')}
      >
        <Icon name="table-cells-large" />
        <span>{t('wall')}</span>
      </button>
      <button
        type="button"
        className={styles.modeButton}
        data-active={mode === 'list'}
        aria-pressed={mode === 'list'}
        onClick={() => onChange('list')}
      >
        <Icon name="list" />
        <span>{t('list')}</span>
      </button>
    </div>
  )
}
