'use client'

import { useRef, useState, type CSSProperties } from 'react'
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
        className={style.strip}
        data-note-id={noteId}
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
