import { notFound } from 'next/navigation'

/**
 * 沒有任何路由吃下的網址會落到這裡。少了這個 catch-all，Next 找不到任何
 * 匹配的 segment，就會直接退回根層 not-found —— 而根 layout 沒有 html/body，
 * 只能吐出 Next 內建的裸 404。接住之後才走得到 [locale]/not-found.tsx，
 * 拿得到 Header、Footer、主題與語系。
 */
export default function CatchAllNotFound() {
  notFound()
}
