'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import type { NoteImage } from '@/app/types/note'
import {
  NOTE_RATIO_FALLBACK,
  noteImageSizes,
  noteLayoutRatio,
} from '@/app/lib/notes/imageRatio'
import NoteLightbox from '@/app/components/notes/NoteLightbox/NoteLightbox'
import style from './NoteMedia.module.scss'

interface NoteMediaProps {
  images: NoteImage[]
  noteId: string
}

/**
 * 短文圖片渲染（前後台共用）：不論張數都是等高橫排，放不下才橫向滑動。
 * 點擊任一張圖片開啟燈箱；燈箱狀態放在這裡而非 provider——同時只會開一個，
 * 而且 FLIP 開闔動畫需要的 trigger rect 本來就要由這裡持有。
 */
export default function NoteMedia({ images, noteId }: NoteMediaProps) {
  const t = useTranslations('NotesPage.lightbox')
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const triggers = useRef<(HTMLButtonElement | null)[]>([])
  const closingIndexRef = useRef<number | null>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const [scrollable, setScrollable] = useState(false)

  // 放不放得下取決於欄寬，CSS 判斷不了，只好量。
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const measure = () => setScrollable(el.scrollWidth > el.clientWidth)
    // 子圖也要觀察：容器尺寸不變時，子圖的寬度仍可能在樣式載入後才定下來
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    for (const child of el.children) ro.observe(child)
    return () => ro.disconnect()
  }, [images.length])

  const handleClose = () => {
    closingIndexRef.current = openIndex
    setOpenIndex(null)
  }

  // 退場動畫真正播完（AnimatePresence onExitComplete）才把焦點還回原本的縮圖，
  // 不然畫面上還在播收合動畫、焦點就先跳走會很突兀。
  const handleClosed = () => {
    const i = closingIndexRef.current
    if (i !== null) triggers.current[i]?.focus()
  }

  if (images.length === 0) return null

  return (
    <>
      <div
        ref={stripRef}
        className={style.strip}
        data-note-id={noteId}
        data-scrollable={scrollable || undefined}
      >
        {images.map((img, i) => {
          const ratio = noteLayoutRatio(img) ?? NOTE_RATIO_FALLBACK
          return (
            <button
              key={img.url}
              ref={(el) => {
                triggers.current[i] = el
              }}
              type="button"
              className={style.slide}
              style={{ '--note-ratio': ratio } as CSSProperties}
              onClick={() => setOpenIndex(i)}
              aria-label={t('open', { n: i + 1 })}
            >
              <Image
                src={img.url}
                alt={img.alt ?? ''}
                fill
                sizes={noteImageSizes(ratio)}
                className={style.img}
              />
            </button>
          )
        })}
      </div>

      <NoteLightbox
        images={images}
        index={openIndex}
        onIndexChange={setOpenIndex}
        onClose={handleClose}
        onClosed={handleClosed}
        getOriginRect={(i) => triggers.current[i]?.getBoundingClientRect() ?? null}
        scrollOriginIntoView={(i) =>
          triggers.current[i]?.scrollIntoView({
            inline: 'center',
            block: 'nearest',
          })
        }
      />
    </>
  )
}
