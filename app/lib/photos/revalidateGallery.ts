import { revalidatePath } from 'next/cache'

/**
 * 讓兩個 gallery 路由的 ISR 快取失效。
 *
 * 傳的是路由樣板（含中括號的動態區段）而不是某一張照片的具體網址：
 * revalidatePath 對 'page' 類型的樣板會讓整個動態路由失效，呼叫端因此
 * 不需要知道是哪個 slug —— 這在刪除的情境特別重要，那時 slug 已經沒了。
 *
 * 抽成共用函式而不是各自寫兩行：路由樣板寫錯不會報錯，只會安靜地不生效，
 * 兩處各寫一份遲早會有一處跟著路由改名而漏改。
 */
export function revalidateGallery(): void {
  revalidatePath('/[locale]/gallery', 'page')
  revalidatePath('/[locale]/gallery/[slug]', 'page')
}
