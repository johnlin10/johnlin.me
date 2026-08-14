'use client'

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Link } from '@/i18n/navigation'
import type { WallCell } from '@/app/lib/photos/wallLayout'
import type { SupportedLocale } from '@/app/types/blog'
import { photoAltText, photoCaption, formatTakenAt } from '@/app/lib/photos/format'
import PhotoMeta from '@/app/components/gallery/PhotoMeta/PhotoMeta'
import styles from './GalleryWall.module.scss'

interface WallPhotoProps {
  cell: WallCell
  locale: SupportedLocale
  isFocused: boolean
  /** srcSet 目標寬度（由縮放級別決定，只升不降） */
  tier: number
  /** 聚焦時回報詳細資訊卡的實測高度（牆座標），供聚焦框校正 fit */
  onFocusCardResize: (h: number) => void
  onActivate: (cell: WallCell) => void
}

/**
 * 牆上的一張照片：牆座標絕對定位的畫框 + 下方資訊卡（與照片同一平面、同步縮放）。
 * 點擊進 focus（攔截 Link，保留 href 當 SEO／中鍵／no-JS 降級）。
 * 聚焦時疊載原檔並淡入 —— HDR 就是在這一刻亮起來。
 */
export default function WallPhoto({
  cell,
  locale,
  isFocused,
  tier,
  onFocusCardResize,
  onActivate,
}: WallPhotoProps) {
  const { photo, x, y, w, photoH, cardY, cardH } = cell
  const caption = photoCaption(photo, locale)
  const date = formatTakenAt(photo.takenAtLocal, photo.takenAtPrecision, locale)
  const [originalLoaded, setOriginalLoaded] = useState(false)

  // 聚焦時量測詳細資訊卡的自然高度並回報（offsetHeight 是版面高度，不受牆縮放影響）
  const focusCardRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!isFocused) return
    const el = focusCardRef.current
    if (!el) return
    const report = () => onFocusCardResize(el.offsetHeight)
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isFocused, onFocusCardResize])

  const handleClick = (e: MouseEvent) => {
    // 只攔左鍵無修飾鍵；中鍵／Cmd+click 仍走真正的 href 開新分頁
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    onActivate(cell)
  }

  return (
    <>
      <Link
        href={`/gallery/${photo.slug}`}
        className={styles.photo}
        style={{
          left: x,
          top: y,
          width: w,
          height: photoH,
          zIndex: isFocused ? 10 : undefined,
        }}
        data-photo-id={photo.id}
        aria-label={photoAltText(photo, locale)}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        onClick={handleClick}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.img}
          srcSet={photo.derivatives.map((d) => `${d.url} ${d.w}w`).join(', ')}
          sizes={`${tier}px`}
          src={photo.derivatives.at(-1)?.url}
          alt=""
          width={photo.width}
          height={photo.height}
          loading="lazy"
          decoding="async"
          draggable={false}
          style={
            photo.blurDataUrl
              ? {
                  backgroundImage: `url(${photo.blurDataUrl})`,
                  backgroundSize: 'cover',
                }
              : undefined
          }
        />
        {isFocused && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.original}
            src={photo.urlOriginal}
            alt=""
            draggable={false}
            onLoad={() => setOriginalLoaded(true)}
            style={{ opacity: originalLoaded ? 1 : 0 }}
          />
        )}
      </Link>

      {isFocused ? (
        // 聚焦：與照片同平面呈現完整資訊（與 /gallery/[slug] 同一份 PhotoMeta）
        <div
          ref={focusCardRef}
          className={styles.focusCard}
          style={{ left: x, top: cardY, width: w }}
        >
          <PhotoMeta photo={photo} locale={locale} as="div" compact />
        </div>
      ) : (
        // 牆上瀏覽：固定尺寸的簡卡（標題＋日期），隨牆同步縮放
        <div
          className={styles.card}
          style={{ left: x, top: cardY, width: w, height: cardH }}
          aria-hidden="true"
        >
          {caption && <span className={styles.cardCaption}>{caption}</span>}
          <span className={styles.cardDate}>{date}</span>
        </div>
      )}
    </>
  )
}
