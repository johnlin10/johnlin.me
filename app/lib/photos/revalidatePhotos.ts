import { revalidatePath, revalidateTag } from 'next/cache'

/**
 * 讓所有吃照片的快取失效：兩個 gallery 路由、首頁，以及首頁那份資料快取。
 *
 * 路由傳的是樣板（含中括號的動態區段）而不是某一張照片的具體網址：
 * revalidatePath 對 'page' 類型的樣板會讓整個動態路由失效，呼叫端因此
 * 不需要知道是哪個 slug —— 這在刪除的情境特別重要，那時 slug 已經沒了。
 *
 * 首頁還要多一刀 revalidateTag：Hero 馬賽克與攝影一瞥的資料是
 * getCachedLatestPhotos 的 unstable_cache（tag: 'photos'），跟頁面本身的
 * ISR 是兩層快取，只重新驗證路由的話頁面會重繪、但照片還是舊的那一份。
 *
 * 抽成共用函式而不是各自寫四行：路由樣板寫錯不會報錯，只會安靜地不生效，
 * 各處自己寫一份遲早會有一處跟著路由改名而漏改。
 */
export function revalidatePhotos(): void {
  revalidatePath('/[locale]/photography', 'page')
  revalidatePath('/[locale]/photography/[slug]', 'page')
  revalidatePath('/[locale]', 'page')
  // 第二個參數是 Next 16 起的必填：'max' 標記為過期但先送舊的、背景換新
  revalidateTag('photos', 'max')
}
