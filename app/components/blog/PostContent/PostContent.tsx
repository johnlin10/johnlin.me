'use client'

import { useEffect, useRef } from 'react'
import katex from 'katex'
import style from './PostContent.module.scss'

interface PostContentProps {
  content: string // TipTap 輸出的 HTML
}

/**
 * 文章內容渲染。
 * 內容由單一可信作者（站主）以 TipTap 撰寫，故直接渲染其 HTML；
 * 排版樣式見 PostContent.module.scss（襯線內文、暖色引言、程式碼區塊）。
 * 數學公式節點存的是 <div data-math data-latex="..."> 空殼（TipTap 的
 * renderHTML 不含 KaTeX 標記，只有編輯器內的 NodeView 會即時渲染），
 * 這裡掛一個 client 端強化：mount 後找出所有 [data-math] 補上 KaTeX。
 */
export default function PostContent({ content }: PostContentProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const nodes = container.querySelectorAll<HTMLElement>('[data-math]')
    nodes.forEach((node) => {
      const latex = node.getAttribute('data-latex') || ''
      try {
        katex.render(latex, node, { throwOnError: false, displayMode: true })
      } catch {
        node.textContent = latex
      }
    })
  }, [content])

  return (
    <div
      ref={containerRef}
      className={style.post_content}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}
