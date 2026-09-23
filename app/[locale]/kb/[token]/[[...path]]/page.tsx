import { cache } from 'react'
import { notFound } from 'next/navigation'
import { getFormatter, getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { Link, redirect } from '@/i18n/navigation'
import { createPublicClient } from '@/app/lib/supabase/public'
import { getKbShare, getKbSharedNote } from '@/app/lib/supabase/kb'
import { buildTree, shareHref, splitNote, type NoteTreeNode } from '@/app/lib/kb'
import { metadata } from '@/app/lib/metadata'
import Icon from '@/app/components/Icon/Icon'
import ThemeToggle from '@/app/components/ThemeToggle/ThemeToggle'
import postStyle from '@/app/components/blog/PostContent/PostContent.module.scss'
import style from './kb-share.module.scss'
import KbMarkdown from './KbMarkdown'
import KbPreviewLink from './KbPreviewLink'

interface KbSharePageProps {
  params: Promise<{ locale: string; token: string; path?: string[] }>
}

// metadata 和頁面各要一次，同一個請求裡只打一次資料庫
const loadShare = cache((token: string) => getKbShare(createPublicClient(), token))
const loadNote = cache((token: string, code: string) =>
  getKbSharedNote(createPublicClient(), token, code),
)

/**
 * 樹上第一篇筆記，網址沒指定筆記時打開分享範圍裡的第一篇。
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
 * 舊網址（v1.13.3 以前用分享路徑）的一段轉回文字。Next 給的有時已經解碼、有時沒有，所以一律再解一次。
 * @param segment 網址的一段
 * @returns 解碼後的文字，格式不對就原樣回傳
 */
// ponytail: 檔名裡有「%」的筆記可能被多解一次而打不開，真的出現再處理
function decodeSegment(segment: string) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/**
 * 這次要看哪篇：網址有代碼就用它，否則是分享的那篇，或分享的資料夾裡第一篇。
 * 已經傳出去的舊網址（分享路徑）轉到代碼網址。
 * @returns token 不對或看不到那篇回 null
 */
async function load({ params }: KbSharePageProps) {
  const { locale, token, path: segments } = await params
  const share = await loadShare(token)
  if (!share) return null
  let code = segments?.length === 1 ? segments[0] : undefined
  if (!segments) {
    const first = firstNote(buildTree(share.notes.filter((n) => n.in_scope).map((n) => n.path)))
    code = share.notes.find((n) => n.path === first)?.code
  } else if (!share.notes.some((n) => n.code === code)) {
    const path = `${segments.map(decodeSegment).join('/').normalize('NFC')}.md`
    const old = share.notes.find((n) => n.path === path)
    if (old) redirect({ href: shareHref(token, old.code), locale })
    return null
  }
  const note = code && (await loadNote(token, code))
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
    // 每篇自己的封面，筆記標題加「分享給你的筆記」（app/api/kb/og/route.ts 現場產生）
    image: `/api/kb/og?${new URLSearchParams({ token: data.token, code: data.note.code, locale })}`,
    // 網址沒帶代碼時打開的就是這篇，og:url 一律指到這篇，平台照 og:url 重抓也不會抓錯篇
    url: shareHref(data.token, data.note.code),
    noIndex: true,
    appendSiteName: false,
  })
  // 網址上的 token 就是鑰匙，點出去的連結不帶 Referer
  return { ...base, referrer: 'no-referrer' }
}

/**
 * 知識庫的分享頁。看得到的是分享的筆記或資料夾，加上順著連結、只經過知識資料夾能連到的筆記；
 * 範圍外的連結顯示成一般文字。網址用筆記代碼，目錄顯示分享路徑。token 不對或看不到那篇就 404。
 * 每次都現場讀，撤銷連結要立刻生效。
 */
export default async function KbSharePage(props: KbSharePageProps) {
  const data = await load(props)
  if (!data) notFound()
  const { token, share, note } = data
  const { locale } = await props.params
  const t = await getTranslations({ locale, namespace: 'KbShare' })
  const format = await getFormatter({ locale })
  const { title, body, ai } = splitNote(note.path, note.content)

  const codes = new Map(share.notes.map((n) => [n.path, n.code]))
  const renderTree = (nodes: NoteTreeNode[]) => (
    <ul className={style.tree}>
      {nodes.map((node) => (
        <li key={node.path}>
          {node.path.endsWith('.md') ? (
            <Link
              href={shareHref(token, codes.get(node.path)!)}
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
          {ai && ` · ${t('ai')}`}
        </p>
        <div className={`${postStyle.post_content} ${style.content}`}>
          <KbMarkdown
            token={token}
            body={body}
            links={note.links}
            renderLink={(href, children, code) => (
              <KbPreviewLink token={token} code={code} href={href}>
                {children}
              </KbPreviewLink>
            )}
          />
        </div>
      </article>

      {/* 手機上目錄是抽屜，用原生 popover：點外面或按 Esc 就收起，不用寫 JS。
          key 跟著筆記換，點了目錄裡的筆記、換頁之後抽屜會重新掛載而收起 */}
      <nav key={note.path} id="kb-nav" popover="auto" className={style.nav} aria-label={t('contents')}>
        {/* 抽屜的標題列在捲動區外面，捲動區上緣才能淡出；桌機的標題跟著目錄捲，捲動區才能頂到視窗上緣 */}
        <div className={style.navHeader}>
          <p className={style.navTitle}>{t('contents')}</p>
          <button
            type="button"
            popoverTarget="kb-nav"
            popoverTargetAction="hide"
            className={style.navClose}
            aria-label={t('close')}
          >
            <Icon name="xmark" />
          </button>
        </div>
        <div className={style.navScroll}>
          <p className={`${style.navTitle} ${style.navScrollTitle}`}>{t('contents')}</p>
          {renderTree(buildTree(share.notes.map((n) => n.path)))}
        </div>
        {/* 固定在目錄底部，不跟著目錄捲動 */}
        <div className={style.navFooter}>
          <ThemeToggle />
        </div>
      </nav>

      <button type="button" popoverTarget="kb-nav" className={style.navToggle}>
        <Icon name="list" />
        {t('contents')}
      </button>
    </main>
  )
}
