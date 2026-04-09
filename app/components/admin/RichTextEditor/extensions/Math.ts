import { Node, mergeAttributes } from '@tiptap/core'

/**
 * 數學公式擴展
 * 支援行內公式 (inline) 和區塊公式 (block)
 */
export const Math = Node.create({
  name: 'math',

  group: 'block',

  content: 'text*',

  marks: '',

  atom: true,

  addAttributes() {
    return {
      latex: {
        default: '',
      },
      type: {
        default: 'block', // 'inline' or 'block'
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-math]',
        getAttrs: (dom) => {
          if (typeof dom === 'string') return {}
          const element = dom as HTMLElement
          return {
            latex: element.getAttribute('data-latex') || '',
            type: 'block',
          }
        },
      },
      {
        tag: 'span[data-math]',
        getAttrs: (dom) => {
          if (typeof dom === 'string') return {}
          const element = dom as HTMLElement
          return {
            latex: element.getAttribute('data-latex') || '',
            type: 'inline',
          }
        },
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const { latex, type } = node.attrs
    const tag = type === 'inline' ? 'span' : 'div'

    return [
      tag,
      mergeAttributes(HTMLAttributes, {
        'data-math': '',
        'data-latex': latex,
        class: type === 'inline' ? 'math-inline' : 'math-block',
      }),
      latex,
    ]
  },

  addNodeView() {
    return ({ node }) => {
      const { latex, type } = node.attrs
      const dom = document.createElement(type === 'inline' ? 'span' : 'div')
      dom.classList.add(type === 'inline' ? 'math-inline' : 'math-block')
      dom.setAttribute('data-math', '')
      dom.setAttribute('data-latex', latex)
      dom.textContent = latex

      return {
        dom,
      }
    }
  },
})

export default Math

