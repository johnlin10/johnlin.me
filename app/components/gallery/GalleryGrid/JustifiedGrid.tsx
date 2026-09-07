'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import type { Photo } from '@/app/types/photo'
import type { SupportedLocale } from '@/app/types/blog'
import { photoAltText, photoCaption, formatTakenAt } from '@/app/lib/photos/format'
import { groupByYear } from '@/app/lib/photos/group'
import { computeJustifiedRows } from '@/app/lib/photos/justified'
import styles from './JustifiedGrid.module.scss'

interface JustifiedGridProps {
  photos: Photo[]
  locale: SupportedLocale
}

// 目標列高／列間距依斷點而定；斷點值對齊 app/styles/_breakpoints.scss 的
// $bp-sm / $bp-lg。這裡只是「目標」——實際列高由 computeJustifiedRows 依
// 容器寬度精算，可能跟目標略有出入，那正是齊行版面的本質。minHeight 是
// 下限（見 computeJustifiedRows 註解），抓目標的六成五，太多張擠同一列
// 時不會被壓到比這更矮。
const MIN_HEIGHT_RATIO = 0.9

function targetsFor(containerWidth: number) {
  const base =
    containerWidth < 600
      ? { rowHeight: 130, gap: 4 }
      : containerWidth < 1024
        ? { rowHeight: 200, gap: 8 }
        : { rowHeight: 260, gap: 8 }
  return { ...base, minHeight: Math.round(base.rowHeight * MIN_HEIGHT_RATIO) }
}

/**
 * Grid 模式的齊行（justified）版面：同一列等高，寬度依比例分配、加總撐滿
 * 容器寬度；不同列可以有不同高度，換照片不必犧牲完整顯示（不裁切、不變形）
 * —— 這需要量測容器實際寬度才能精算，只有掛載後的 JS 環境做得到，所以是
 * GalleryExperience 在使用者切到 Grid 模式、且已掛載時才會用到的版本；
 * SSR／no-JS／爬蟲走的是 GalleryGrid 那份不需要 JS 的簡化版基準版面。
 */
export default function JustifiedGrid({ photos, locale }: JustifiedGridProps) {
  const t = useTranslations('GalleryPage')
  const groups = useMemo(() => groupByYear(photos), [photos])

  const containerRef = useRef<HTMLElement | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    const measure = () => setWidth(node.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  if (photos.length === 0) {
    return <p className={styles.empty}>{t('empty')}</p>
  }

  const { rowHeight, gap, minHeight } = targetsFor(width)

  return (
    <nav ref={containerRef} className={styles.grid} aria-label={t('gridView')}>
      {groups.map((group) => (
        <section key={group.year} className={styles.group}>
          <h2 className={styles.year}>{group.year}</h2>
          <div className={styles.rows} style={{ gap }}>
            {width > 0 &&
              computeJustifiedRows(
                group.photos,
                width,
                rowHeight,
                gap,
                minHeight,
              ).map((row, i) => (
                <div key={i} className={styles.row} style={{ gap }}>
                  {row.items.map(({ photo, width: itemWidth }) => {
                    const caption = photoCaption(photo, locale)
                    const date = formatTakenAt(
                      photo.takenAtLocal,
                      photo.takenAtPrecision,
                      locale,
                      { omitCurrentYear: true },
                    )
                    return (
                      <Link
                        key={photo.id}
                        href={`/gallery/${photo.slug}`}
                        className={styles.item}
                        style={{ width: itemWidth }}
                      >
                        <span
                          className={styles.frame}
                          style={{ height: row.height }}
                        >
                          {/* 原生 <img>：R2 已備好 srcSet 各階、出站免費，刻意
                              不走 Vercel optimizer。
                              frame 的寬高就是 computeJustifiedRows 算好的結果，
                              跟照片自身比例一致，object-fit:cover 不會裁到。   */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            className={styles.img}
                            srcSet={photo.derivatives
                              .map((d) => `${d.url} ${d.w}w`)
                              .join(', ')}
                            sizes="(max-width: 600px) 55vw, 420px"
                            src={photo.derivatives[0]?.url}
                            alt={photoAltText(photo, locale)}
                            width={photo.width}
                            height={photo.height}
                            loading="lazy"
                            decoding="async"
                            style={
                              photo.blurDataUrl
                                ? {
                                    backgroundImage: `url(${photo.blurDataUrl})`,
                                    backgroundSize: 'cover',
                                  }
                                : undefined
                            }
                          />
                          <span className={styles.overlay} aria-hidden="true">
                            {caption && (
                              <span className={styles.caption}>{caption}</span>
                            )}
                            <time
                              className={styles.date}
                              dateTime={photo.takenAtLocal.slice(0, 10)}
                            >
                              {date}
                            </time>
                          </span>
                        </span>
                      </Link>
                    )
                  })}
                </div>
              ))}
          </div>
        </section>
      ))}
    </nav>
  )
}
