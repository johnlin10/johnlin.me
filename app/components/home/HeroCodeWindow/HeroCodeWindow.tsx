'use client'

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import style from './HeroCodeWindow.module.scss'

type Props = {
  code: string
  fileName?: string
}

// 高度固定，截斷交給外層 overflow
export default function HeroCodeWindow({
  code,
  fileName = 'HeroShowcase.tsx',
}: Props) {
  return (
    <div className={style.codeWindow}>
      <div className={style.codeWindowBar} aria-hidden>
        <span className={style.codeWindowDots}>
          <span className={`${style.codeWindowDot} ${style.dotRed}`} />
          <span className={`${style.codeWindowDot} ${style.dotYellow}`} />
          <span className={`${style.codeWindowDot} ${style.dotGreen}`} />
        </span>
        <span className={style.codeWindowFileName}>{fileName}</span>
      </div>
      <div className={style.codeWindowBody}>
        <SyntaxHighlighter
          language="tsx"
          style={oneDark as any}
          showLineNumbers
          customStyle={{
            margin: 0,
            padding: '12px',
            background: 'transparent',
            fontSize: '0.6rem',
            lineHeight: 1.6,
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}
