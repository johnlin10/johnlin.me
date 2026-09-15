import type { CSSProperties } from 'react'

// 色相以 oklch 為準，明度和彩度在 CSS 裡依主題各算一次
export const COURSE_COLORS = [
  { key: 'red', hue: 25 },
  { key: 'orange', hue: 55 },
  { key: 'amber', hue: 75 },
  { key: 'yellow', hue: 95 },
  { key: 'lime', hue: 125 },
  { key: 'green', hue: 145 },
  { key: 'teal', hue: 180 },
  { key: 'cyan', hue: 205 },
  { key: 'sky', hue: 230 },
  { key: 'blue', hue: 255 },
  { key: 'indigo', hue: 275 },
  { key: 'violet', hue: 295 },
  { key: 'purple', hue: 320 },
  { key: 'pink', hue: 350 },
  { key: 'gray', hue: 0 },
] as const

/**
 * 課程色塊用的 CSS 變數，不認得的 key 當灰色。
 * @param key 顏色 key
 * @returns 帶 --course-hue、--course-chroma 的 style
 */
export function courseColorStyle(key: string | null): CSSProperties {
  const color = COURSE_COLORS.find((c) => c.key === key)
  return {
    '--course-hue': color?.hue ?? 0,
    '--course-chroma': color && color.key !== 'gray' ? 1 : 0,
  } as CSSProperties
}

/**
 * 挑用得最少的顏色，平手時照表上的順序。
 * @param used 已經在用的顏色 key
 * @returns 顏色 key
 */
export function leastUsedColor(used: string[]): string {
  const counts = COURSE_COLORS.map((c) => used.filter((key) => key === c.key).length)
  return COURSE_COLORS[counts.indexOf(Math.min(...counts))].key
}
