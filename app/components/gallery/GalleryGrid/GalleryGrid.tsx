import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import type { Photo } from '@/app/types/photo'
import type { SupportedLocale } from '@/app/types/blog'
import { photoAltText, photoCaption, formatTakenAt } from '@/app/lib/photos/format'
import { groupByYear } from '@/app/lib/photos/group'
import styles from './GalleryGrid.module.scss'

interface GalleryGridProps {
  photos: Photo[]
  locale: SupportedLocale
}

/**
 * 攝影作品的語意化網格，Server Component。一石三鳥：
 * ① 給爬蟲一組指向每張 /photography/[slug] 的內鏈（沒有這個，牆是 canvas 式黑洞，
 *    爬蟲從 /photography 找不到任何一張照片）；② no-JS 與螢幕閱讀器的可用版本；
 * ③ reduced-motion 使用者的替代路徑。牆（Stage 4）會把它當降級層包在裡面。
 *
 * 版面刻意簡單：CSS 多欄（columns）瀑布流，每張照片維持自己的原始比例、
 * 不裁切、欄與欄之間也不會因高矮不一而留破洞。列高整齊、貼滿容器邊緣的
 * 「齊行」版面需要量測容器寬度才能精準分列，那是 JS 才做得到的事，交給
 * GalleryExperience 掛載後切換的 Grid 模式（見 JustifiedGrid）；這裡只負責
 * 一個不需要 JS 也能用、不裁切、不破版的基準版面。
 */
export default async function GalleryGrid({
  photos,
  locale,
}: GalleryGridProps) {
  const t = await getTranslations({ locale, namespace: 'GalleryPage' })
  const groups = groupByYear(photos)

  if (photos.length === 0) {
    return <p className={styles.empty}>{t('empty')}</p>
  }

  return (
    <nav className={styles.grid} aria-label={t('gridView')}>
      {groups.map((group) => (
        <section key={group.year} className={styles.group}>
          <h2 className={styles.year}>{group.year}</h2>
          <ol className={styles.columns}>
            {group.photos.map((photo) => {
              const caption = photoCaption(photo, locale)
              const date = formatTakenAt(
                photo.takenAtLocal,
                photo.takenAtPrecision,
                locale,
                { omitCurrentYear: true }
              )
              return (
                <li key={photo.id} className={styles.item}>
                  <Link href={`/photography/${photo.slug}`} className={styles.link}>
                    <span
                      className={styles.frame}
                      style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
                    >
                      {/* 原生 <img>：R2 已備好 srcSet 各階、出站免費，刻意不走
                          Vercel optimizer（見 Stage 3 決策）。frame 的 aspect-ratio
                          就是照片自己的比例，object-fit:cover 在這裡不會裁切
                          （框跟圖同比例，cover 等於精準貼合）。 */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className={styles.img}
                        srcSet={photo.derivatives
                          .map((d) => `${d.url} ${d.w}w`)
                          .join(', ')}
                        sizes="(max-width: 600px) 45vw, 240px"
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
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </nav>
  )
}
