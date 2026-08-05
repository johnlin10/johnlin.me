// pathname 來自 @/i18n/navigation，已去掉 locale 前綴（zh-tw 無前綴、en 為 /en/...）。
// 錨定 $ 是關鍵：/admin/posts（列表頁）不能中，/admin/posts/<id>[/write|/settings] 才能中。
// 裸的 /admin/posts/<id> 也算進來——那是導去 /write 的即時 redirect 頁，
// 同樣不該閃一下側邊欄。/admin/posts/<id>/edit（舊路由 stub）刻意不中。
const FULLSCREEN_ADMIN_POST_EDITOR =
  /^\/admin\/posts\/(new|[^/]+(?:\/(write|settings))?)$/

export function isFullscreenAdminRoute(pathname: string): boolean {
  return FULLSCREEN_ADMIN_POST_EDITOR.test(pathname)
}
