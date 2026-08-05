'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { getSeries } from '@/app/lib/supabase/series'
import { createClient } from '@/app/lib/supabase/client'
import type { Series } from '@/app/types/blog'
import Input from '@/app/components/admin/Input/Input'
import style from './Selector.module.scss'

interface SeriesSelectorProps {
  seriesId: string
  seriesOrder: number
  onSeriesChange: (seriesId: string) => void
  onOrderChange: (order: number) => void
  locale?: 'zh-tw' | 'en'
  label?: string
}

/**
 * 系列選擇器（含順序）
 */
export default function SeriesSelector({
  seriesId,
  seriesOrder,
  onSeriesChange,
  onOrderChange,
  locale = 'zh-tw',
  label,
}: SeriesSelectorProps) {
  const t = useTranslations('AdminPage.selectors.series')
  const resolvedLabel = label ?? t('label')
  const [seriesList, setSeriesList] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    loadSeries()
  }, [])

  const loadSeries = async () => {
    try {
      const data = await getSeries(supabase)
      setSeriesList(data)
    } catch (error) {
      console.error('載入系列失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={style.selector_wrapper}>
        {resolvedLabel && <label className={style.label}>{resolvedLabel}</label>}
        <div className={style.loading}>{t('loading')}</div>
      </div>
    )
  }

  return (
    <div className={style.selector_wrapper}>
      {resolvedLabel && <label className={style.label}>{resolvedLabel}</label>}
      <div className={style.series_container}>
        <select
          value={seriesId}
          onChange={(e) => onSeriesChange(e.target.value)}
          className={style.select}
        >
          <option value="">{t('none')}</option>
          {seriesList.map((series) => (
            <option key={series.id} value={series.id}>
              {series.locales[locale].name}
            </option>
          ))}
        </select>

        {seriesId && (
          <div className={style.series_order}>
            <Input
              label={t('orderLabel')}
              value={seriesOrder.toString()}
              onChange={(value) => onOrderChange(parseInt(value) || 1)}
              type="number"
              placeholder={t('orderPlaceholder')}
              helper={t('orderHelper')}
            />
          </div>
        )}
      </div>
    </div>
  )
}

