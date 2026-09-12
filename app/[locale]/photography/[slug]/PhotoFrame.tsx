'use client'

import { useState } from 'react'
import type { Photo } from '@/app/types/photo'
import styles from './photo.module.scss'

interface PhotoFrameProps {
  photo: Photo
  alt: string
}

/**
 * 衍生檔一律是 SDR（sharp 重新編碼時會丟色域／HDR），原檔才留得住 HDR。
 * 只有 HDR 照片才疊載原檔並淡入 —— 與 GalleryWall 聚焦、HeroShowcase 同一套。
 */
export default function PhotoFrame({ photo, alt }: PhotoFrameProps) {
  const [originalLoaded, setOriginalLoaded] = useState(false)

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.img}
        srcSet={photo.derivatives.map((d) => `${d.url} ${d.w}w`).join(', ')}
        sizes="(max-width: 900px) 100vw, 1080px"
        src={photo.derivatives.at(-1)?.url ?? photo.urlOriginal}
        alt={alt}
        width={photo.width}
        height={photo.height}
        fetchPriority="high"
        decoding="async"
        style={
          photo.blurDataUrl
            ? { backgroundImage: `url(${photo.blurDataUrl})`, backgroundSize: 'cover' }
            : undefined
        }
      />
      {photo.isHdr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.original}
          src={photo.urlOriginal}
          alt=""
          decoding="async"
          onLoad={() => setOriginalLoaded(true)}
          style={{ opacity: originalLoaded ? 1 : 0 }}
        />
      )}
    </>
  )
}
