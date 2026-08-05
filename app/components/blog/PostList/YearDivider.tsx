import { getTranslations } from 'next-intl/server'
import type { SupportedLocale } from '@/app/types/blog'
import style from './PostList.module.scss'

/**
 * 年份分隔。必須是列表容器的直接子元素，卡片模式才能靠 grid-column 橫跨整排。
 */
export default async function YearDivider({
  year,
  locale,
}: {
  year: number
  locale: SupportedLocale
}) {
  const t = await getTranslations({ locale, namespace: 'BlogPage' })

  // 年份要以字串代入：ICU 會把數字參數套上千分位，`2024` 會變成 `2,024`。
  return <h2 className={style.yearDivider}>{t('yearDivider', { year: String(year) })}</h2>
}
