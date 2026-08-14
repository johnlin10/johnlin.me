import type { Photo } from '@/app/types/photo'

export interface PhotoYearGroup {
  year: number
  photos: Photo[]
}

/** 依 takenAtLocal 的年份分組，photos 已按時間新到舊排序，同年份自然相鄰。 */
export function groupByYear(photos: Photo[]): PhotoYearGroup[] {
  const groups: PhotoYearGroup[] = []
  for (const photo of photos) {
    const year = Number.parseInt(photo.takenAtLocal.slice(0, 4), 10)
    const last = groups.at(-1)
    if (last?.year === year) last.photos.push(photo)
    else groups.push({ year, photos: [photo] })
  }
  return groups
}
