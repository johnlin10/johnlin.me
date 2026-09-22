import { cache } from 'react'
import { notFound } from 'next/navigation'
import { getFormatter, getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Link } from '@/i18n/navigation'
import { createPublicClient } from '@/app/lib/supabase/public'
import { getKbShare, getKbSharedNote } from '@/app/lib/supabase/kb'
import { buildTree, linkify, splitNote, type NoteTreeNode } from '@/app/lib/kb'
import { metadata } from '@/app/lib/metadata'
import postStyle from '@/app/components/blog/PostContent/PostContent.module.scss'
import style from './kb-share.module.scss'

interface KbSharePageProps {
  params: Promise<{ locale: string; token: string }>
  searchParams: Promise<{ p?: string | string[] }>
}

// metadata 和頁面各要一次，同一個請求裡只打一次資料庫
const loadShare = cache((token: string) => getKbShare(createPublicClient(), token))
const loadNote = cache((token: string, path: string) =>
  getKbSharedNote(createPublicClient(), token, path),
)

/**
 * 筆記的網址。路徑放在查詢字串：proxy 的 matcher 會跳過含「.」的路徑，檔名帶點就進不來。
 * @param token 分享 token
 * @param path 筆記路徑
 * @returns 站內網址
 */
function hrefOf(token: string, path: string) {
  return `/kb/${token}?p=${encodeURIComponent(path.replace(/\.md$/, ''))}`
}

/**
 * 樹上第一篇筆記，資料夾分享沒指定筆記時打開它。
 * @param nodes 樹
 * @returns 筆記路徑
 */
function firstNote(nodes: NoteTreeNode[]): string | undefined {
  for (const node of nodes) {
    const found = node.path.endsWith('.md') ? node.path : firstNote(node.children)
    if (found) return found
  }
}

/**
 * 這次要看哪篇：網址有指定就用它，否則是分享的那篇，或分享的資料夾裡第一篇。
 * @returns token 不對或看不到那篇回 null
 */
async function load({ params, searchParams }: KbSharePageProps) {
  const { token } = await params
  const { p } = await searchParams
  const share = await loadShare(token)
  if (!share) return null
  const path =
    typeof p === 'string'
      ? `${p.normalize('NFC')}.md`
      : share.scope.endsWith('.md')
        ? share.scope
        : firstNote(
            buildTree(share.notes.map((n) => n.path).filter((n) => n.startsWith(share.scope))),
          )
  const note = path && (await loadNote(token, path))
  return note ? { token, share, note } : null
}

export async function generateMetadata(props: KbSharePageProps): Promise<Metadata> {
  const data = await load(props)
  // token 不對的 404 頁不帶這頁的標題，不透露這個網址底下有東西
  if (!data) return {}
  const { locale } = await props.params
  const t = await getTranslations({ locale, namespace: 'KbShare' })
  const base = await metadata({
    title: splitNote(data.note.path, data.note.content).title,
    description: t('description'),
    url: `/kb/${data.token}`,
    noIndex: true,
    appendSiteName: false,
  })
  // 網址上的 token 就是鑰匙，點出去的連結不帶 Referer
  return { ...base, referrer: 'no-referrer' }
}

/**
 * 知識庫的分享頁。看得到的是分享的筆記或資料夾，加上它們直接連到的筆記；
 * 範圍外的連結顯示成一般文字。token 不對或看不到那篇就 404。
 * 每次都現場讀，撤銷連結要立刻生效。
 */
export default async function KbSharePage(props: KbSharePageProps) {
  const data = await load(props)
  if (!data) notFound()
  const { token, share, note } = data
  const { locale } = await props.params
  const t = await getTranslations({ locale, namespace: 'KbShare' })
  const format = await getFormatter({ locale })
  const { title, body } = splitNote(note.path, note.content)

  const renderTree = (nodes: NoteTreeNode[]) => (
    <ul className={style.tree}>
      {nodes.map((node) => (
        <li key={node.path}>
          {node.path.endsWith('.md') ? (
            <Link
              href={hrefOf(token, node.path)}
              className={style.treeNote}
              aria-current={node.path === note.path ? 'page' : undefined}
            >
              {node.name}
            </Link>
          ) : (
            <>
              <span className={style.treeFolder}>{node.name}</span>
              {renderTree(node.children)}
            </>
          )}
        </li>
      ))}
    </ul>
  )

  return (
    <main className={style.shell}>
      <article className={style.article}>
        <h1 className={style.title}>{title}</h1>
        <p className={style.updated}>
          {t('updated', { date: format.dateTime(new Date(note.updated_at), { dateStyle: 'long' }) })}
        </p>
        <div className={`${postStyle.post_content} ${style.content}`}>
          <Markdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              a: ({ href, children }) =>
                href?.startsWith('/kb/') ? (
                  <Link href={href}>{children}</Link>
                ) : (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
            }}
          >
            {linkify(body, (target) => {
              const path = note.links[target]
              return path ? hrefOf(token, path) : null
            })}
          </Markdown>
        </div>
      </article>

      <nav className={style.nav} aria-label={t('contents')}>
        <p className={style.navTitle}>{t('contents')}</p>
        {renderTree(buildTree(share.notes.map((n) => n.path)))}
      </nav>
    </main>
  )
}
