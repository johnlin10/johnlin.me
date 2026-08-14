import type { Photo } from '@/app/types/photo'

export interface JustifiedRowItem {
  photo: Photo
  width: number
}

export interface JustifiedRow {
  /** 這一列的高度（px）。列與列之間可以不同，同一列內一律共用這個高度。 */
  height: number
  items: JustifiedRowItem[]
}

/**
 * 齊行（justified）版面：把照片分成一列列，同一列共用一個高度，寬度依各自
 * 的比例分配，加總後精確撐滿 containerWidth —— 因為是整列的寬跟高一起用
 * 同一個縮放係數縮放，比例不變，所以不裁切、不變形。不同列可以有不同高度
 * （含最後一列），這樣才放得下各種長寬比而不必犧牲完整顯示。
 *
 * minHeight 是下限：太多張（尤其是窄比例的直幅照片）擠進同一列時，若硬要
 * 縮到剛好撐滿容器寬度，列高可能被壓得很矮、照片變得很小。所以塞下一張前
 * 會先試算「加了這張，本列要縮多高才能撐滿寬度」，低於下限就不加，讓這張
 * 開新的一列——本列因此可能沒有精確撐滿容器寬度，但至少不會擠成一條窄縫。
 * 只有一張的列不受此限（沒有別的張可以分擔，硬性下限反而會逼它裁切/變形）。
 */
export function computeJustifiedRows(
  photos: Photo[],
  containerWidth: number,
  targetHeight: number,
  gap: number,
  minHeight: number
): JustifiedRow[] {
  if (containerWidth <= 0 || photos.length === 0) return []

  const rows: JustifiedRow[] = []
  let row: { photo: Photo; ratio: number }[] = []
  let ratioSum = 0

  const flush = () => {
    if (row.length === 0) return
    const rowHeight = (containerWidth - gap * (row.length - 1)) / ratioSum
    rows.push({
      height: rowHeight,
      items: row.map(({ photo, ratio }) => ({
        photo,
        width: rowHeight * ratio,
      })),
    })
    row = []
    ratioSum = 0
  }

  for (const photo of photos) {
    const ratio = photo.width / photo.height

    if (row.length > 0) {
      const nextRatioSum = ratioSum + ratio
      const nextCount = row.length + 1
      const heightIfAdded =
        (containerWidth - gap * (nextCount - 1)) / nextRatioSum
      if (heightIfAdded < minHeight) flush() // 加了這張會擠過頭，本列先收
    }

    row.push({ photo, ratio })
    ratioSum += ratio
    const naturalWidth = targetHeight * ratioSum + gap * (row.length - 1)
    if (naturalWidth >= containerWidth) flush()
  }
  flush() // 最後一列不足也照樣撐滿：同一個縮放係數同時放大寬高，不裁切

  return rows
}
