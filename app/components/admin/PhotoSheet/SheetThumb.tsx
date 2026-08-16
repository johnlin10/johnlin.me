'use client'

import { forwardRef } from 'react'
import { useTranslations } from 'next-intl'
import type { Photo } from '@/app/types/photo'
import type { SupportedLocale } from '@/app/types/blog'
import { photoAltText } from '@/app/lib/photos/format'
import Icon from '@/app/components/Icon/Icon'
import style from './PhotoSheet.module.scss'

interface SheetThumbProps {
  photo: Photo
  locale: SupportedLocale
  width: number
  height: number
  selected: boolean
  checked: boolean
  onSelect: () => void
  onToggleChecked: () => void
}

/**
 * 印象表裡的一張縮圖。role="option" + 手動 tabIndex（roving tabindex，
 * 由 ContactSheet 統一決定哪一個是 0）—— 不是原生 <button> 的預設 tab 順序，
 * 因為整個印象表要表現成「一個 tab 停駐點」而不是每張圖各自停一次。
 *
 * 用 forwardRef 把 DOM 節點交給 ContactSheet：J/K 換選取時要真的把
 * 瀏覽器焦點也移過去，不能只改 React state。
 */
const SheetThumb = forwardRef<HTMLButtonElement, SheetThumbProps>(
  function SheetThumb(
    { photo, locale, width, height, selected, checked, onSelect, onToggleChecked },
    ref
  ) {
    const t = useTranslations('AdminPage.photos')
    // 縮圖只需要看得出構圖，限前兩階就夠涵蓋一般到高 DPI 螢幕，
    // 沒必要為了印象表的小圖載大階。
    const srcSet = photo.derivatives
      .slice(0, 2)
      .map((d) => `${d.url} ${d.w}w`)
      .join(', ')

    return (
      <button
        ref={ref}
        type="button"
        role="option"
        aria-selected={selected}
        tabIndex={selected ? 0 : -1}
        className={`${style.thumb} ${selected ? style.thumbSelected : ''} ${
          checked ? style.thumbChecked : ''
        }`}
        style={{ width, height }}
        // 勾選走修飾鍵而不是疊一個 checkbox 上去：role="option" 底下不能再放
        // 互動元素（listbox 的子代只能是 option／group），硬塞會讓讀屏的
        // 結構壞掉。修飾鍵點選是檔案總管那一套，鍵盤則是 Space。
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey) onToggleChecked()
          else onSelect()
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={style.thumbImg}
          src={photo.derivatives[0]?.url}
          srcSet={srcSet}
          sizes={`${Math.round(width)}px`}
          alt={photoAltText(photo, locale)}
          loading="lazy"
          decoding="async"
          style={
            photo.blurDataUrl
              ? { backgroundImage: `url(${photo.blurDataUrl})`, backgroundSize: 'cover' }
              : undefined
          }
        />
        {photo.status === 'draft' && (
          <span className={style.thumbBadge}>{t('status.draft')}</span>
        )}
        {photo.isHdr && (
          <span className={`${style.thumbBadge} ${style.thumbBadgeHdr}`}>HDR</span>
        )}
        {checked && (
          <span className={style.thumbCheck} aria-hidden>
            <Icon name="check" size="xs" />
          </span>
        )}
      </button>
    )
  }
)

export default SheetThumb
