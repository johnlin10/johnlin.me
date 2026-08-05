// 極簡 YAML frontmatter 解析器（無外部依賴，見 rss.ts 的手寫慣例）。
// 只支援純量欄位（string / number），足夠 About 章節的 id / title / order 使用；
// 若未來需要陣列或多行值，屆時再評估換用 gray-matter。

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/

export interface Frontmatter {
  [key: string]: string | number
}

export function parseFrontmatter(raw: string): {
  data: Frontmatter
  body: string
} {
  const text = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n')
  const match = FRONTMATTER_RE.exec(text)

  if (!match) {
    return { data: {}, body: text }
  }

  const data: Frontmatter = {}
  for (const line of match[1].split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const colonIndex = trimmed.indexOf(':') // 只切第一個冒號，值本身含冒號才不會壞
    if (colonIndex === -1) continue

    const key = trimmed.slice(0, colonIndex).trim()
    let value = trimmed.slice(colonIndex + 1).trim()

    if (/^(".*"|'.*')$/.test(value)) {
      value = value.slice(1, -1)
    }

    data[key] = /^-?\d+$/.test(value) ? Number(value) : value
  }

  return { data, body: text.slice(match[0].length).replace(/^\n+/, '') }
}
