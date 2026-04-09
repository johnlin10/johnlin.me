'use client'

import { useEffect, useState } from 'react'
import { getAllSeries } from '@/app/lib/firebase/series'
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
  label = '連載系列',
}: SeriesSelectorProps) {
  const [seriesList, setSeriesList] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSeries()
  }, [])

  const loadSeries = async () => {
    try {
      const data = await getAllSeries()
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
        {label && <label className={style.label}>{label}</label>}
        <div className={style.loading}>載入中...</div>
      </div>
    )
  }

  return (
    <div className={style.selector_wrapper}>
      {label && <label className={style.label}>{label}</label>}
      <div className={style.series_container}>
        <select
          value={seriesId}
          onChange={(e) => onSeriesChange(e.target.value)}
          className={style.select}
        >
          <option value="">無（不屬於任何系列）</option>
          {seriesList.map((series) => (
            <option key={series.id} value={series.id}>
              {series.locales[locale].name}
            </option>
          ))}
        </select>

        {seriesId && (
          <div className={style.series_order}>
            <Input
              label="在系列中的順序"
              value={seriesOrder.toString()}
              onChange={(value) => onOrderChange(parseInt(value) || 1)}
              type="number"
              placeholder="1"
              helper="此文章在系列中的順序（從 1 開始）"
            />
          </div>
        )}
      </div>
    </div>
  )
}

