import { Node, mergeAttributes } from '@tiptap/core'
import katex from 'katex'

/**
 * 數學公式節點——區塊級 KaTeX 顯示公式。
 * atom（不可在節點內部編輯內文）：要修改公式請透過工具列的「編輯公式」
 * 重新輸入，不支援行內公式（inline math 需要不同的 schema group，
 * 增加的複雜度目前不值得，先出區塊公式）。
 */
export const Math = Node.create({
  name: 'math',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      latex: {
        default: '',
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-math]',
        getAttrs: (dom) => ({
          latex: (dom as HTMLElement).getAttribute('data-latex') || '',
        }),
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-math': '',
        'data-latex': node.attrs.latex,
        class: 'math-block',
      }),
    ]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.classList.add('math-block')
      dom.setAttribute('data-math', '')
      dom.setAttribute('data-latex', node.attrs.latex)
      try {
        katex.render(node.attrs.latex, dom, {
          throwOnError: false,
          displayMode: true,
        })
      } catch {
        dom.textContent = node.attrs.latex
      }
      return { dom }
    }
  },
})

export default Math
