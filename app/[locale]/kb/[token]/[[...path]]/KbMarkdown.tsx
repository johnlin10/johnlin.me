import type { ReactNode } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { linkify, shareHref } from '@/app/lib/kb'

interface KbMarkdownProps {
  token: string
  /** 去掉標題和 frontmatter 的內文 */
  body: string
  /** 連結目標 → 分享路徑，只有看得到的 */
  links: Record<string, string>
  /** 站內筆記連結怎麼畫 */
  renderLink: (href: string, children: ReactNode, path: string) => ReactNode
}

/**
 * 筆記內文。分享頁和懸停預覽共用，[[連結]] 先換成 Markdown 連結，看不到的只留文字。
 */
export default function KbMarkdown({ token, body, links, renderLink }: KbMarkdownProps) {
  const paths = new Map(Object.values(links).map((path) => [shareHref(token, path), path]))
  return (
    <Markdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        a: ({ href, children }) => {
          const path = href && paths.get(href)
          return path ? (
            renderLink(href, children, path)
          ) : (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          )
        },
      }}
    >
      {linkify(body, (target) => (links[target] ? shareHref(token, links[target]) : null))}
    </Markdown>
  )
}
