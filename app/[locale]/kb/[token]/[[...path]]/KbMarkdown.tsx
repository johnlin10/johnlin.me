import type { ReactNode } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from 'rehype-sanitize'
import { linkify, shareHref } from '@/app/lib/kb'
import style from './kb-share.module.scss'

interface KbMarkdownProps {
  token: string
  /** 去掉標題和 frontmatter 的內文 */
  body: string
  /** 連結目標 → 代碼，只有看得到的 */
  links: Record<string, string>
  /** 站內筆記連結怎麼畫 */
  renderLink: (href: string, children: ReactNode, code: string) => ReactNode
}

const SVG_TAGS = ['svg', 'g', 'rect', 'line', 'circle', 'text', 'path']
const SVG_ATTRS = ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'd', 'width', 'height', 'fill', 'fillOpacity', 'stroke', 'strokeOpacity', 'strokeWidth', 'strokeDasharray', 'textAnchor', 'fontSize', 'fontWeight']

// 筆記裡可以內嵌 SVG 圖（如知覺圖），其餘 HTML 照 GitHub 的白名單過濾，分享頁不會跑筆記裡的 script
const schema: SanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), ...SVG_TAGS],
  attributes: {
    ...defaultSchema.attributes,
    ...Object.fromEntries(SVG_TAGS.map((tag) => [tag, SVG_ATTRS])),
    svg: ['viewBox', 'role', 'ariaLabel', ...SVG_ATTRS],
  },
}

/**
 * 筆記內文。分享頁和懸停預覽共用，[[連結]] 先換成 Markdown 連結，看不到的只留文字。
 */
export default function KbMarkdown({ token, body, links, renderLink }: KbMarkdownProps) {
  const codes = new Map(Object.values(links).map((code) => [shareHref(token, code), code]))
  return (
    <Markdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, schema], rehypeKatex]}
      components={{
        table: ({ children }) => (
          <div className={style.tableScroll}>
            <table>{children}</table>
          </div>
        ),
        a: ({ href, children }) => {
          const code = href && codes.get(href)
          return code ? (
            renderLink(href, children, code)
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
