'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Reorder } from 'motion/react'
import { useTranslations } from 'next-intl'
import Icon from '@/app/components/Icon/Icon'
import Input from '@/app/components/admin/Input/Input'
import AiButton from '@/app/components/admin/AiButton/AiButton'
import Popover from '@/app/components/admin/Popover/Popover'
import NoteLightbox from '@/app/components/notes/NoteLightbox/NoteLightbox'
import type { NoteImage } from '@/app/types/note'
import style from './NoteComposer.module.scss'

interface NoteImageTrayProps {
  images: NoteImage[]
  /** 純排序（拖曳），不觸發任何刪除副作用。 */
  onReorder: (images: NoteImage[]) => void
  /** 明確的移除動作，交給呼叫端決定要不要順便清 Storage。 */
  onRemove: (index: number) => void
  onAltChange: (index: number, alt: string) => void
  aiPendingIndex: number | null
  onGenerateAlt: (index: number) => void
}

/**
 * 上傳圖片的編輯盤：滿版圖片縮圖、整張圖片按住拖曳排序、點擊圖片開啟 Lightbox 預覽、
 * Hover 顯示刪除與設定描述按鈕、懸浮彈窗編輯 Alt 與 AI 產生。
 */
export default function NoteImageTray({
  images,
  onReorder,
  onRemove,
  onAltChange,
  aiPendingIndex,
  onGenerateAlt,
}: NoteImageTrayProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const itemRefs = useRef<(HTMLElement | null)[]>([])

  return (
    <>
      <Reorder.Group
        axis="x"
        values={images}
        onReorder={onReorder}
        className={style.tray}
      >
        {images.map((img, i) => (
          <TrayItem
            key={img.url}
            img={img}
            itemRef={(el) => {
              itemRefs.current[i] = el
            }}
            onOpenLightbox={() => setLightboxIndex(i)}
            onRemove={() => onRemove(i)}
            onAltChange={(alt) => onAltChange(i, alt)}
            aiPending={aiPendingIndex === i}
            onGenerateAlt={() => onGenerateAlt(i)}
          />
        ))}
      </Reorder.Group>

      {/* 點擊縮圖後顯示的滿版燈箱預覽 */}
      <NoteLightbox
        images={images}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        onClose={() => setLightboxIndex(null)}
        getOriginRect={(i) => itemRefs.current[i]?.getBoundingClientRect() ?? null}
        scrollOriginIntoView={(i) =>
          itemRefs.current[i]?.scrollIntoView({ block: 'nearest' })
        }
      />
    </>
  )
}

function TrayItem({
  img,
  itemRef,
  onOpenLightbox,
  onRemove,
  onAltChange,
  aiPending,
  onGenerateAlt,
}: {
  img: NoteImage
  itemRef: (el: HTMLElement | null) => void
  onOpenLightbox: () => void
  onRemove: () => void
  onAltChange: (alt: string) => void
  aiPending: boolean
  onGenerateAlt: () => void
}) {
  const t = useTranslations('AdminPage.notes')
  const [showAltPopover, setShowAltPopover] = useState(false)
  const altBtnRef = useRef<HTMLButtonElement>(null)

  return (
    <Reorder.Item value={img} className={style.item} ref={itemRef}>
      <div
        className={`${style.thumb} ${showAltPopover ? style.activePopover : ''}`}
        onClick={onOpenLightbox}
      >
        <Image src={img.url} alt={img.alt ?? ''} fill sizes="120px" className={style.thumbImg} />

        {/* 靜態已設定 Alt 的標籤標誌 (非 hover 時顯現) */}
        {img.alt && !showAltPopover && (
          <div className={style.altBadge} title={img.alt}>
            <Icon name="check" size="xs" />
            <span>ALT</span>
          </div>
        )}

        {/* Hover 遮罩與控制動作 */}
        <div className={style.overlay}>
          <button
            type="button"
            className={style.removeThumb}
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={t('removeImageAriaLabel')}
            title={t('removeImageAriaLabel')}
          >
            <Icon name="xmark" />
          </button>

          <button
            ref={altBtnRef}
            type="button"
            className={`${style.altBtn} ${img.alt ? style.hasAlt : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              setShowAltPopover((prev) => !prev)
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title={t('altPlaceholder')}
          >
            <Icon name="comment" size="xs" />
            <span>{img.alt ? t('altLabel') : t('altPlaceholder')}</span>
          </button>
        </div>
      </div>

      {/* 通用懸浮描述彈窗 (Popover) */}
      <Popover
        isOpen={showAltPopover}
        onClose={() => setShowAltPopover(false)}
        anchorRef={altBtnRef}
        title={t('altLabel')}
        width={280}
      >
        <Input
          value={img.alt ?? ''}
          onChange={onAltChange}
          placeholder={t('altPlaceholder')}
          action={
            <AiButton
              label={t('aiAltLabel')}
              pending={aiPending}
              onClick={onGenerateAlt}
            />
          }
        />
      </Popover>
    </Reorder.Item>
  )
}
