'use client'

import { useTranslations } from 'next-intl'
import {
  PHOTO_FILTER_KEYS,
  type PhotoFilterKey,
} from '@/app/lib/photos/adminFilters'
import Icon from '@/app/components/Icon/Icon'
import style from './PhotoSheet.module.scss'

interface FilterChipsProps {
  counts: Record<PhotoFilterKey, number>
  active: ReadonlySet<PhotoFilterKey>
  onToggle: (key: PhotoFilterKey) => void
  onClear: () => void
}

/**
 * 篩選 chips：不是拿來找某一張，是拿來看「還有哪些沒弄完」。
 * AND 組合，數字永遠算在全集上（見 adminFilters.ts），不會跟目前的篩選結果脫鉤。
 */
export default function FilterChips({
  counts,
  active,
  onToggle,
  onClear,
}: FilterChipsProps) {
  const t = useTranslations('AdminPage.photos.filters')

  return (
    <div className={style.filterChips}>
      <Icon name="filter" size="xs" className={style.filterIcon} />
      {PHOTO_FILTER_KEYS.map((key) => {
        const count = counts[key]
        const isActive = active.has(key)
        if (count === 0 && !isActive) return null
        return (
          <button
            key={key}
            type="button"
            className={`${style.chip} ${isActive ? style.chipActive : ''}`}
            onClick={() => onToggle(key)}
            aria-pressed={isActive}
          >
            {t(key)}
            <span className={style.chipCount}>{count}</span>
          </button>
        )
      })}
      {active.size > 0 && (
        <button type="button" className={style.chipClear} onClick={onClear}>
          {t('clear')}
        </button>
      )}
    </div>
  )
}
