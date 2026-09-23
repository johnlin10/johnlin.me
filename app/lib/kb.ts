// 能上傳的最上層資料夾。個人日記這類東西不該有機會被傳上來
export const KB_ROOTS = ['學校']

// vault 裡寫給 AI 的規則檔，不是筆記
const IGNORED_FILES = new Set(['CLAUDE.md', 'AGENTS.md'])

/**
 * 這個路徑算不算筆記：.md 檔、不在隱藏資料夾裡、不是規則檔。
 * @param path 相對 vault 根目錄的路徑
 * @returns 算筆記回 true
 */
export function isNotePath(path: string): boolean {
  const segments = path.split('/')
  return (
    path.endsWith('.md') &&
    segments.every((segment) => segment !== '' && !segment.startsWith('.')) &&
    !IGNORED_FILES.has(segments[segments.length - 1])
  )
}

// ponytail: 程式碼區塊裡的 [[...]] 也會被當成連結，筆記裡真的出現再處理
const WIKILINK = /!?\[\[([^\]\n]+)\]\]/g

/**
 * 拆開 [[目標#標題|別名]]。表格裡的 `\|` 也認得。
 * @param inner 兩層中括號裡的文字
 * @returns 目標（去掉 .md，本篇標題連結是空字串）、標題、別名
 */
function parseLink(inner: string) {
  const [ref, alias] = inner.split(/\\?\|/)
  const [target, heading] = ref.split('#')
  return {
    target: target.trim().replace(/\.md$/, ''),
    heading: heading?.trim() || undefined,
    alias: alias?.trim() || undefined,
  }
}

/**
 * 取出內文所有 [[連結]] 的目標，去掉別名、#標題和 .md，不重複。
 * @param content Markdown 內文
 * @returns 連結目標
 */
export function extractLinks(content: string): string[] {
  const targets = new Set<string>()
  for (const [, inner] of content.normalize('NFC').matchAll(WIKILINK)) {
    const { target } = parseLink(inner)
    if (target) targets.add(target)
  }
  return [...targets]
}

/**
 * 把 [[連結]] 換成 Markdown 連結；對不到的換成一般文字，不露出目標是哪篇。
 * 顯示文字照 Obsidian：有別名用別名，否則是「名稱 > 標題」。
 * @param content Markdown 內文
 * @param hrefOf 目標名稱 → 網址；看不到的回 null
 * @returns 可以直接給 Markdown 渲染的內文
 */
export function linkify(content: string, hrefOf: (target: string) => string | null): string {
  return content.normalize('NFC').replace(WIKILINK, (_, inner: string) => {
    const { target, heading, alias } = parseLink(inner)
    const name = target.split('/').pop()
    const text = (alias ?? [name, heading].filter(Boolean).join(' > ')).replace(/[[\]]/g, '\\$&')
    const href = target && hrefOf(target)
    return href ? `[${text}](<${href}>)` : text
  })
}

/**
 * 分享頁上一篇筆記的網址，不帶 .md。
 * @param token 分享 token
 * @param path 分享路徑
 * @returns 站內網址
 */
export function shareHref(token: string, path: string): string {
  const segments = path.replace(/\.md$/, '').split('/').map(encodeURIComponent)
  return `/kb/${token}/${segments.join('/')}`
}

/**
 * 筆記的標題（檔名）、去掉 frontmatter 的內文，和 frontmatter 有沒有標 `ai: true`。
 * 內文第一行就是同名的 # 標題時一起拿掉，免得顯示兩次。
 * @param path 筆記路徑
 * @param content Markdown 原文
 * @returns 標題、內文、是否與 AI 共同編輯
 */
export function splitNote(path: string, content: string): { title: string; body: string; ai: boolean } {
  const title = path.split('/').pop()!.replace(/\.md$/, '')
  const text = content.replace(/\r\n/g, '\n')
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---[ \t]*(\n|$)/)
  const ai = /^ai:[ \t]*true[ \t]*$/m.test(frontmatter?.[1] ?? '')
  const body = text.slice(frontmatter?.[0].length ?? 0).replace(/^\s+/, '')
  const heading = body.match(/^# (.+)\n?/)
  return { title, body: heading?.[1].trim() === title ? body.slice(heading[0].length) : body, ai }
}

/**
 * 內容的 sha-256，上傳時跟資料庫比對用。
 * @param content 檔案內容
 * @returns 64 碼十六進位字串
 */
export async function hashContent(content: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export type SyncPlan = {
  added: string[]
  changed: string[]
  removed: string[]
}

/**
 * 比對這次上傳的檔案和資料庫，算出要新增、更新、刪除哪些。
 * @param local 這次上傳的 path → hash
 * @param remote 資料庫裡同一個 root 底下的 path → hash
 * @returns 三份路徑清單
 */
export function planSync(local: Map<string, string>, remote: Map<string, string>): SyncPlan {
  const added: string[] = []
  const changed: string[] = []
  for (const [path, hash] of local) {
    if (!remote.has(path)) added.push(path)
    else if (remote.get(path) !== hash) changed.push(path)
  }
  const removed = [...remote.keys()].filter((path) => !local.has(path))
  return { added, changed, removed }
}

export type NoteTreeNode = {
  name: string
  /** 資料夾是 '學校/115-1/'，筆記是 '學校/115-1/x.md' */
  path: string
  children: NoteTreeNode[]
}

const collator = new Intl.Collator('zh-Hant', { numeric: true })

/**
 * 把路徑清單排成樹。同一層資料夾在前、筆記在後，各自照名稱自然排序（第 2 週在第 10 週前面）。
 * @param paths 筆記路徑
 * @returns 最上層的節點
 */
export function buildTree(paths: string[]): NoteTreeNode[] {
  const root: NoteTreeNode = { name: '', path: '', children: [] }
  for (const path of paths) {
    let node = root
    const segments = path.split('/')
    segments.forEach((name, i) => {
      const isNote = i === segments.length - 1
      const childPath = isNote ? path : `${segments.slice(0, i + 1).join('/')}/`
      let child = node.children.find((c) => c.path === childPath)
      if (!child) {
        child = { name: isNote ? name.replace(/\.md$/, '') : name, path: childPath, children: [] }
        node.children.push(child)
      }
      node = child
    })
  }
  const sort = (nodes: NoteTreeNode[]) => {
    nodes.sort(
      (a, b) =>
        Number(a.path.endsWith('.md')) - Number(b.path.endsWith('.md')) ||
        collator.compare(a.name, b.name),
    )
    nodes.forEach((n) => sort(n.children))
  }
  sort(root.children)
  return root.children
}
