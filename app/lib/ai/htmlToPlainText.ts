/** 去掉 HTML 標籤與多餘空白，取得可讀的純文字（供 AI 摘要輸入用）。 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
