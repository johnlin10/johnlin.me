import { getTranslations } from 'next-intl/server'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { Link } from '@/i18n/navigation'
import type { Photo } from '@/app/types/photo'
import type { SupportedLocale } from '@/app/types/blog'
import { photoAltText } from '@/app/lib/photos/format'
import PhotoMeta from '@/app/components/gallery/PhotoMeta/PhotoMeta'
import Reveal from '../Reveal/Reveal'
import ScatterCard from '../ScatterCard/ScatterCard'
import shared from '../shared.module.scss'
import style from './PhotographyGlimpse.module.scss'

// 尚無照片時的空相框骨架
const FRAMES = ['frameTall', 'frameWide', 'frameSquare']

// 三個散落槽，與 ThreeThings 同一套（傾斜角與錯位寫在 scss 的 slot class）。
// depth 刻意不同，捲動時三張飄移速度不一。
const SLOTS: { slot: string; depth: number }[] = [
  { slot: 'scatterA', depth: 34 },
  { slot: 'scatterB', depth: 58 },
  { slot: 'scatterC', depth: 22 },
]

// 攝影牆入口按鈕的六張空白相片，顏色只是色塊，不代表任何真實照片
const WALL_CHIPS = [0, 1, 2, 3, 4, 5]

export default async function PhotographyGlimpse({
  locale,
  photos = [],
}: {
  locale: string
  photos?: Photo[]
}) {
  const t = await getTranslations({
    locale,
    namespace: 'HomePage.photographyGlimpse',
  })
  const loc = locale as SupportedLocale

  return (
    <section className={shared.section}>
      <div className={shared.container}>
        <Reveal>
          <div className={shared.sectionHead}>
            <span className={shared.label}>{t('label')}</span>
            <h2 className={shared.heading}>{t('heading')}</h2>
          </div>
        </Reveal>

        {photos.length === 0 ? (
          <Reveal delay={0.1}>
            <div className={style.glimpseEmpty}>
              <div className={style.ghostFrames} aria-hidden>
                {FRAMES.map((f, i) => (
                  <span
                    key={f}
                    className={`${style.ghostFrame} ${style[f]}`}
                    style={{ ['--i' as string]: i }}
                  />
                ))}
              </div>
              <p className={shared.emptyText}>{t('empty')}</p>
            </div>
          </Reveal>
        ) : (
          <div className={style.glimpseScatter}>
            {photos.slice(0, 3).map((photo, i) => {
              const { slot, depth } = SLOTS[i] ?? SLOTS[SLOTS.length - 1]
              return (
                <ScatterCard
                  key={photo.id}
                  depth={depth}
                  delay={i * 0.08}
                  className={`${style.glimpseCell} ${style[slot]}`}
                >
                  {/* 相片與底下的資訊是同一個整體，一起傾斜、一起回正 */}
                  <figure className={style.photoCard}>
                    <Link
                      href={`/gallery/${photo.slug}`}
                      className={style.photoFrame}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className={style.photoImg}
                        srcSet={photo.derivatives
                          .map((d) => `${d.url} ${d.w}w`)
                          .join(', ')}
                        sizes="(max-width: 600px) 92vw, 360px"
                        src={photo.derivatives.at(-1)?.url ?? photo.urlOg}
                        alt={photoAltText(photo, loc)}
                        width={photo.width}
                        height={photo.height}
                        loading="lazy"
                        decoding="async"
                        style={
                          photo.blurDataUrl
                            ? { backgroundImage: `url(${photo.blurDataUrl})` }
                            : undefined
                        }
                      />
                    </Link>
                    <PhotoMeta photo={photo} locale={loc} showExif={false} />
                  </figure>
                </ScatterCard>
              )
            })}
          </div>
        )}

        <Reveal delay={0.1}>
          {/* 疊起來的相片本身就是入口：hover 展開成 2×3 的牆。
              hover 綁在整個 <a> 上，游標走到相片縫隙也不會掉出狀態。 */}
          <Link href="/gallery" className={style.wallCta}>
            <span className={style.wallStack} aria-hidden>
              {WALL_CHIPS.map((i) => (
                <span key={i} className={style.wallChip} />
              ))}
            </span>
            <span className={style.wallCtaLabel}>
              {t('cta')}
              <FontAwesomeIcon icon={faArrowRight} />
            </span>
          </Link>
        </Reveal>
      </div>
    </section>
  )
}
