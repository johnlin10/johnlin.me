import Image from 'next/image'
import type { LinkPreview } from '@/app/types/note'
import style from './NoteLinkCard.module.scss'

interface NoteLinkCardProps {
  preview: LinkPreview
  /** large：沒有圖片的短文，上圖下文；compact：有圖片時縮成一列，圖左文右 */
  variant: 'large' | 'compact'
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * 短文的網址預覽卡（前後台共用）。資料是發布時抓好存進 DB 的，這裡只負責呈現。
 * 沒有 hook，伺服器元件與客戶端元件都能直接用。
 */
export default function NoteLinkCard({ preview, variant }: NoteLinkCardProps) {
  const { url, title, description, siteName, image } = preview
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${style.card} ${style[variant]}`}
    >
      {image && (
        <span className={style.cover}>
          <Image
            src={image}
            alt=""
            fill
            sizes={variant === 'large' ? '(max-width: 600px) 100vw, 720px' : '200px'}
            className={style.img}
          />
        </span>
      )}
      <span className={style.text}>
        <span className={style.site}>{siteName ?? hostname(url)}</span>
        <span className={style.title}>{title}</span>
        {description && <span className={style.description}>{description}</span>}
      </span>
    </a>
  )
}
