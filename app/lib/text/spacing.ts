// 漢字與半形字元之間的排版空白（俗稱「盤古之白」）。
// Intl / 資料庫來的字串都不會自己加，中文介面文字要顯示前手動補一次。

const CJK = '\\u4e00-\\u9fff\\u3400-\\u4dbf'
const HALF = '0-9A-Za-z'

const CJK_THEN_HALF = new RegExp(`([${CJK}])([${HALF}])`, 'g')
const HALF_THEN_CJK = new RegExp(`([${HALF}])([${CJK}])`, 'g')

/**
 * 在漢字與半形數字／拉丁字母之間補一個半形空格。
 * 例：`2024年3月2日` → `2024 年 3 月 2 日`。
 *
 * 只給中文語系用。已經有空格的地方不會重複加（正則要求兩字元相鄰）。
 */
export function spaceCJK(text: string): string {
  return text.replace(CJK_THEN_HALF, '$1 $2').replace(HALF_THEN_CJK, '$1 $2')
}
