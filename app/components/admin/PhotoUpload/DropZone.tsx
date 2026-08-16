'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { PHOTO_ACCEPT_ATTR } from '@/app/lib/photos/mime'
import Icon from '@/app/components/Icon/Icon'
import style from './PhotoUpload.module.scss'

interface DropZoneProps {
  onFiles: (files: File[]) => void
}

/**
 * 拖放／選檔入口。accept 只寫 PHOTO_ACCEPT_ATTR 的白名單 —— 這是體驗層的
 * 第一道防線，真正擋住 HEIC／DNG 的是呼叫端用 isSupportedPhotoMime 篩選。
 */
export default function DropZone({ onFiles }: DropZoneProps) {
  const t = useTranslations('AdminPage.photos.upload')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return
    onFiles(Array.from(list))
  }

  return (
    <div
      className={`${style.dropzone} ${dragging ? style.dragging : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        handleFiles(e.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={PHOTO_ACCEPT_ATTR}
        multiple
        className={style.hiddenInput}
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <Icon name="upload" size="xl" className={style.dropzoneIcon} />
      <p className={style.dropzoneTitle}>{t('dropTitle')}</p>
      <p className={style.dropzoneHint}>{t('dropHint')}</p>
    </div>
  )
}
