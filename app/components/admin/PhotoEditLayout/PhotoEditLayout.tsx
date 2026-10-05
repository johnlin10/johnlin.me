'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import Icon from '@/app/components/Icon/Icon'
import style from './PhotoEditLayout.module.scss'

interface PhotoEditLayoutProps {
  src: string
  /** 原始像素尺寸。有了就先撐出正確比例的相框，圖還沒載好也不會塌成一條白邊。 */
  width?: number
  height?: number
  /** 圖載好之前墊在底下的模糊縮圖（blurDataUrl）。 */
  placeholder?: string
  /**
   * HDR 原檔。衍生檔一律是 SDR，HDR 照片要把原檔疊上去、載好再淡入，
   * 跟前台單張頁（PhotoFrame）同一套。
   */
  hdrSrc?: string
  isHdr?: boolean
  /** 照片下方的前台說明預覽（PhotoMeta）。 */
  meta?: ReactNode
  /** 右欄的欄位。 */
  panel: ReactNode
  /** 底部列中間，通常是 Filmstrip。 */
  filmstrip: ReactNode
  /** 上一張／下一張；沒給（已經在頭尾）時箭頭停用。 */
  onPrev?: () => void
  onNext?: () => void
}

/**
 * 單張照片的編輯版面，上傳頁與照片頁共用：照片放大在左、欄位在右、
 * 縮圖列固定在底部。電腦上整塊剛好一個視窗高、頁面不捲；平板以下上下疊、
 * 整頁捲（見樣式檔）。
 *
 * 換照片時呼叫端會用 key 整顆重掛載，hdrSrc 的淡入狀態因此跟著歸零。
 */
export default function PhotoEditLayout({
  src,
  width,
  height,
  placeholder,
  hdrSrc,
  isHdr,
  meta,
  panel,
  filmstrip,
  onPrev,
  onNext,
}: PhotoEditLayoutProps) {
  const t = useTranslations('AdminPage.photos.upload')
  const [hdrLoaded, setHdrLoaded] = useState(false)
  const ratio = width && height ? width / height : undefined

  return (
    <div className={style.layout}>
      <div className={style.editor}>
        <div className={style.stage}>
          <div className={style.printArea}>
            <div
              className={`${style.print} ${ratio ? style.sized : ''}`}
              style={ratio ? ({ '--ratio': ratio } as CSSProperties) : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                decoding="async"
                style={
                  placeholder
                    ? { backgroundImage: `url(${placeholder})`, backgroundSize: 'cover' }
                    : undefined
                }
              />
              {hdrSrc && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={style.original}
                  src={hdrSrc}
                  alt=""
                  decoding="async"
                  onLoad={() => setHdrLoaded(true)}
                  style={{ opacity: hdrLoaded ? 1 : 0 }}
                />
              )}
              {isHdr && <span className={style.hdrBadge}>HDR</span>}
            </div>
          </div>
          {meta && <div className={style.meta}>{meta}</div>}
        </div>
        <div className={style.panel}>{panel}</div>
      </div>

      <div className={style.footer}>
        <button
          type="button"
          className={style.navTile}
          onClick={onPrev}
          disabled={!onPrev}
          aria-label={t('prev')}
        >
          <Icon name="arrow-left" />
        </button>
        {filmstrip}
        <button
          type="button"
          className={style.navTile}
          onClick={onNext}
          disabled={!onNext}
          aria-label={t('next')}
        >
          <Icon name="arrow-right" />
        </button>
      </div>
    </div>
  )
}
