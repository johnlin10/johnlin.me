import type { Photo } from '@/app/types/photo'

//* ==================== 印象表篩選 chips ====================
// 純模組：篩選與計數共用同一份判斷式，才不會讓 chip 上的數字跟實際篩出來
// 的結果走鐘。日常工作不是「找某一張」，是「還有哪些沒弄完」，
// 所以這裡的重點是缺漏，不是排序或搜尋。

export type PhotoFilterKey = 'draft' | 'noCaption' | 'noEnglish' | 'hasGps' | 'hdr'

export const PHOTO_FILTER_KEYS: PhotoFilterKey[] = [
  'draft',
  'noCaption',
  'noEnglish',
  'hasGps',
  'hdr',
]

const PREDICATES: Record<PhotoFilterKey, (photo: Photo) => boolean> = {
  draft: (photo) => photo.status === 'draft',
  noCaption: (photo) => !photo.locales['zh-tw']?.caption,
  // photoCaption() 會 fallback 回 zh-tw，前台看起來正常，只有這個 chip
  // 找得出「英文其實沒寫」。
  noEnglish: (photo) => !photo.locales.en?.caption,
  hasGps: (photo) => photo.location !== undefined,
  hdr: (photo) => photo.isHdr,
}

/** AND 語意：多個 chip 一起開，篩出同時符合全部條件的照片。 */
export function applyPhotoFilters(
  photos: Photo[],
  active: ReadonlySet<PhotoFilterKey>
): Photo[] {
  if (active.size === 0) return photos
  return photos.filter((photo) =>
    [...active].every((key) => PREDICATES[key](photo))
  )
}

/** 每個 chip 各自的符合數量，永遠算在「未篩選前」的全集上。 */
export function countPhotoFilters(photos: Photo[]): Record<PhotoFilterKey, number> {
  const counts: Record<PhotoFilterKey, number> = {
    draft: 0,
    noCaption: 0,
    noEnglish: 0,
    hasGps: 0,
    hdr: 0,
  }
  for (const photo of photos) {
    for (const key of PHOTO_FILTER_KEYS) {
      if (PREDICATES[key](photo)) counts[key]++
    }
  }
  return counts
}
