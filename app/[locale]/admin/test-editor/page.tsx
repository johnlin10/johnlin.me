'use client'

import { useState } from 'react'
import RichTextEditor from '@/app/components/admin/RichTextEditor/RichTextEditor'
import Button from '@/app/components/admin/Button/Button'
import style from './test-editor.module.scss'

/**
 * 編輯器測試頁面
 * 用於測試和展示 RichTextEditor 組件
 */
export default function TestEditorPage() {
  const [content, setContent] = useState('<p>這是一個測試編輯器。</p>')
  const [showHtml, setShowHtml] = useState(false)

  return (
    <div className={style.test_editor_page}>
      <div className={style.container}>
        <div className={style.header}>
          <h1 className={style.title}>富文本編輯器測試</h1>
          <Button onClick={() => setShowHtml(!showHtml)}>
            {showHtml ? '顯示編輯器' : '顯示 HTML'}
          </Button>
        </div>

        {showHtml ? (
          <div className={style.html_preview}>
            <h3>HTML 輸出：</h3>
            <pre className={style.html_code}>{content}</pre>
          </div>
        ) : (
          <div className={style.editor_container}>
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder="開始撰寫你的文章..."
            />
          </div>
        )}

        <div className={style.instructions}>
          <h3>功能測試清單：</h3>
          <ul>
            <li>✓ 粗體、斜體、底線、刪除線</li>
            <li>✓ 標題（H1、H2、H3）</li>
            <li>✓ 無序列表、有序列表、引用</li>
            <li>✓ 連結插入與移除</li>
            <li>✓ 圖片上傳（使用 base64 預覽）</li>
            <li>✓ 程式碼區塊與語法高亮</li>
            <li>✓ 行內程式碼</li>
            <li>✓ 分隔線</li>
            <li>✓ 復原/重做</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

