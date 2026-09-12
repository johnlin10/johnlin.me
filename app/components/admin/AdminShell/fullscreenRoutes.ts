// pathname 以後台為根、不含語系前綴（見 AdminShell）。
// 錨定 $ 是關鍵：/posts（列表頁）不能中，/posts/<id>[/write|/settings] 才能中。
// 裸的 /posts/<id> 也算進來——那是導去 /write 的即時 redirect 頁，
// 同樣不該閃一下側邊欄。/posts/<id>/edit（舊路由 stub）刻意不中。
const FULLSCREEN_ADMIN_POST_EDITOR =
  /^\/posts\/(new|[^/]+(?:\/(write|settings))?)$/

export function isFullscreenAdminRoute(pathname: string): boolean {
  return FULLSCREEN_ADMIN_POST_EDITOR.test(pathname)
}
