import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['en', 'zh-tw'],

  // Used when no locale matches
  defaultLocale: 'zh-tw',

  // 預設語系（zh-tw）不顯示前綴，只有 /en 會出現前綴
  localePrefix: 'as-needed',
})
