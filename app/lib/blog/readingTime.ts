import { htmlToPlainText } from '@/app/lib/ai/htmlToPlainText'

// 中日韓表意文字 + 日文假名 + 韓文音節。中文一個「字」就是一個閱讀單位，
// 不能跟英文一樣按空白切詞。
const CJK_CHARS = /[一-鿿㐀-䶿぀-ヿ가-힯]/g
const IMG_TAG = /<img\b/gi

const CJK_PER_SECOND = 360 / 60
const WORDS_PER_SECOND = 220 / 60
/** 圖片不是「讀」的，但確實佔時間；給固定秒數並設上限，免得圖多的攝影文被灌水。 */
const SECONDS_PER_IMAGE = 8
const MAX_COUNTED_IMAGES = 10

/**
 * 由文章 HTML 估算閱讀時間（分鐘，最少 1 分鐘）。
 * 中英混排分開計速，圖片另計。
 */
export function readingTimeMinutes(html: string | undefined): number {
  if (!html) return 1

  // 圖片要在剝標籤之前數。
  const images = Math.min(html.match(IMG_TAG)?.length ?? 0, MAX_COUNTED_IMAGES)

  const text = htmlToPlainText(html)
  const cjk = text.match(CJK_CHARS)?.length ?? 0
  const words = text
    .replace(CJK_CHARS, ' ')
    .split(/\s+/)
    .filter((token) => /[0-9A-Za-z]/.test(token)).length

  const seconds =
    cjk / CJK_PER_SECOND +
    words / WORDS_PER_SECOND +
    images * SECONDS_PER_IMAGE

  return Math.max(1, Math.round(seconds / 60))
}
