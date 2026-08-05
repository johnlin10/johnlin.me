import type { SupportedLocale } from '@/app/types/blog'
import { spaceCJK } from '@/app/lib/text/spacing'

// 全站文章日期一律以台北時區呈現。
//
// 這在 server component 是真的會出事的坑：Vercel runtime 是 UTC，台灣時間
// 晚上 8 點之後發的文，SSR 出來的日期會少一天；跨年那幾個小時「是不是今年」
// 也會判斷錯，年份分隔會跟著分錯組。所以格式化與取年份都綁死同一個時區，
// 不要用 new Date().getFullYear()。
const TIME_ZONE = 'Asia/Taipei'

const INTL_LOCALE: Record<SupportedLocale, string> = {
  'zh-tw': 'zh-TW',
  en: 'en-US',
}

// en-CA 是為了拿到 YYYY 這種純數字輸出，跟介面語系無關。
const yearFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
})

// 只有 (語系 × 要不要年份) 四種組合，建一次重複用，列表一次渲染 30 張卡片才不會一直 new。
const dateFormatters = new Map<string, Intl.DateTimeFormat>()

function getDateFormatter(locale: SupportedLocale, withYear: boolean) {
  const key = `${locale}:${withYear}`
  let formatter = dateFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(INTL_LOCALE[locale] ?? 'zh-TW', {
      timeZone: TIME_ZONE,
      month: 'long',
      day: 'numeric',
      ...(withYear ? { year: 'numeric' as const } : {}),
    })
    dateFormatters.set(key, formatter)
  }
  return formatter
}

function toDate(iso: string | undefined): Date | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

/** 該時間點在台北時區的西元年，年份分組與「是否今年」都用這支。 */
export function getTaipeiYear(iso: string | undefined): number | null {
  const date = toDate(iso)
  return date ? Number(yearFormatter.format(date)) : null
}

/** 現在的台北年份。 */
export function getCurrentTaipeiYear(): number {
  return Number(yearFormatter.format(new Date()))
}

/**
 * 文章日期。今年只顯示月日，往年才帶年份；一律不顯示時分。
 * 中文會補上漢字與數字之間的半形空格（`2024 年 3 月 2 日`）。
 */
export function formatPostDate(
  iso: string | undefined,
  locale: SupportedLocale
): string {
  const date = toDate(iso)
  if (!date) return ''

  const withYear = Number(yearFormatter.format(date)) !== getCurrentTaipeiYear()
  const formatted = getDateFormatter(locale, withYear).format(date)

  return locale === 'zh-tw' ? spaceCJK(formatted) : formatted
}
