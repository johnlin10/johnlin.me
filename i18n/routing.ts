import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['en', 'zh-tw'],

  // Used when no locale matches
  defaultLocale: 'zh-tw',

  // 預設語系（zh-tw）不顯示前綴，只有 /en 會出現前綴
  localePrefix: 'as-needed',

  // next-intl 預設不帶 maxAge，等同 session cookie，瀏覽器一關就消失，
  // 導致使用者切換的語言偏好無法跨瀏覽器重啟保留。這裡明確指定一年效期。
  localeCookie: {
    maxAge: 60 * 60 * 24 * 365,
  },
})
