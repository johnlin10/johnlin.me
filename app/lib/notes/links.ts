//* 短文內文的網址處理：找第一個網址、切成文字／連結片段、藏掉結尾的預覽網址。
// 不能 import 路徑別名：links.test.mjs 直接用 node 跑這個檔。

// ponytail: 只認 ASCII 網址字元，中文路徑要是百分比編碼才抓得完整；
// 換來的是「網址後面直接接中文」也能切對，中文短文這種情況多得多。
const URL_RE = /https?:\/\/[!#-;=?-~]+/g

const TRAILING_PUNCT = /[.,;:!?'"\]}>]$/

/**
 * 去掉網址尾端黏到的標點。右括號只在網址裡沒有對應的左括號時才去掉，
 * 維基百科那種 `Foo_(bar)` 的網址才不會被切斷。
 */
function trimUrl(raw: string): string {
  let url = raw
  for (;;) {
    if (TRAILING_PUNCT.test(url)) {
      url = url.slice(0, -1)
    } else if (
      url.endsWith(')') &&
      url.split('(').length < url.split(')').length
    ) {
      url = url.slice(0, -1)
    } else {
      return url
    }
  }
}

export type LinkSegment = { type: 'text' | 'link'; value: string }

/**
 * 把一段文字切成文字與連結片段，渲染端把 link 包成 <a>。
 * @param text 一段內文
 * @returns 依原順序排列的片段，接起來等於原文
 */
export function splitLinks(text: string): LinkSegment[] {
  const segments: LinkSegment[] = []
  let last = 0
  for (const match of text.matchAll(URL_RE)) {
    const url = trimUrl(match[0])
    const start = match.index
    if (start > last) segments.push({ type: 'text', value: text.slice(last, start) })
    segments.push({ type: 'link', value: url })
    last = start + url.length
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) })
  return segments
}

/**
 * @param content 短文內文
 * @returns 第一個網址，沒有則 null
 */
export function findFirstUrl(content: string): string | null {
  return splitLinks(content).find((s) => s.type === 'link')?.value ?? null
}

/**
 * 內文以預覽卡的網址結尾時把它去掉（卡片已經是連結）；網址在句中則原樣保留。
 * @param content 短文內文
 * @param url 預覽卡的網址
 * @returns 去掉結尾網址後的內文
 */
export function stripTrailingUrl(content: string, url: string): string {
  const trimmed = content.trimEnd()
  if (!trimmed.endsWith(url)) return content
  return trimmed.slice(0, -url.length).trimEnd()
}
