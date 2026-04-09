'use client'

import { Editor } from '@tiptap/react'
import { useCallback, useState } from 'react'
import style from './MenuBar.module.scss'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBold,
  faCheck,
  faCircle,
  faCode,
  faHeading,
  faImage,
  faItalic,
  faLink,
  faLinkSlash,
  faList,
  faListOl,
  faListUl,
  faQuoteLeft,
  faRedo,
  faStrikethrough,
  faUnderline,
  faUndo,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'

interface MenuBarProps {
  editor: Editor | null
  onImageUpload: (file: File) => void
}

/**
 * 編輯器工具列
 */
export default function MenuBar({ editor, onImageUpload }: MenuBarProps) {
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  //* 插入連結
  const handleSetLink = useCallback(() => {
    if (linkUrl && editor) {
      editor.chain().focus().setLink({ href: linkUrl }).run()
      setLinkUrl('')
      setShowLinkInput(false)
    }
  }, [editor, linkUrl])

  //* 取消連結
  const handleUnsetLink = useCallback(() => {
    if (editor) {
      editor.chain().focus().unsetLink().run()
    }
  }, [editor])

  //* 圖片上傳
  const handleImageClick = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        onImageUpload(file)
      }
    }
    input.click()
  }, [onImageUpload])

  //* 插入程式碼區塊
  const handleCodeBlock = useCallback(() => {
    if (editor) {
      editor.chain().focus().toggleCodeBlock().run()
    }
  }, [editor])

  if (!editor) {
    return null
  }

  return (
    <div className={style.menu_bar}>
      {/* 文字格式 */}
      <div className={style.button_group}>
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? style.active : ''}
          title="粗體 (Ctrl+B)"
        >
          <FontAwesomeIcon icon={faBold} />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? style.active : ''}
          title="斜體 (Ctrl+I)"
        >
          <FontAwesomeIcon icon={faItalic} />{' '}
        </button>

        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={editor.isActive('underline') ? style.active : ''}
          title="底線 (Ctrl+U)"
        >
          <FontAwesomeIcon icon={faUnderline} />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={editor.isActive('strike') ? style.active : ''}
          title="刪除線"
        >
          <FontAwesomeIcon icon={faStrikethrough} />
        </button>
      </div>

      <div className={style.divider}></div>

      {/* 標題 */}
      <div className={style.button_group}>
        <button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          className={
            editor.isActive('heading', { level: 1 }) ? style.active : ''
          }
          title="標題 1"
        >
          <FontAwesomeIcon icon={faHeading} />
          <code>1</code>
        </button>

        <button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={
            editor.isActive('heading', { level: 2 }) ? style.active : ''
          }
          title="標題 2"
        >
          <FontAwesomeIcon icon={faHeading} />
          <code>2</code>
        </button>

        <button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          className={
            editor.isActive('heading', { level: 3 }) ? style.active : ''
          }
          title="標題 3"
        >
          <FontAwesomeIcon icon={faHeading} />
          <code>3</code>
        </button>
      </div>

      <div className={style.divider}></div>

      {/* 列表 */}
      <div className={style.button_group}>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? style.active : ''}
          title="無序列表"
        >
          <FontAwesomeIcon icon={faListUl} />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? style.active : ''}
          title="有序列表"
        >
          <FontAwesomeIcon icon={faListOl} />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive('blockquote') ? style.active : ''}
          title="引用"
        >
          <FontAwesomeIcon icon={faQuoteLeft} />
        </button>
      </div>

      <div className={style.divider}></div>

      {/* 連結 */}
      <div className={style.button_group}>
        {!showLinkInput ? (
          <>
            <button
              onClick={() => {
                const previousUrl = editor.getAttributes('link').href
                setLinkUrl(previousUrl || '')
                setShowLinkInput(true)
              }}
              className={editor.isActive('link') ? style.active : ''}
              title="插入連結"
            >
              <FontAwesomeIcon icon={faLink} />
            </button>
            {editor.isActive('link') && (
              <button onClick={handleUnsetLink} title="移除連結">
                <FontAwesomeIcon icon={faLinkSlash} />
              </button>
            )}
          </>
        ) : (
          <div className={style.link_input_wrapper}>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              className={style.link_input}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSetLink()
                } else if (e.key === 'Escape') {
                  setShowLinkInput(false)
                }
              }}
            />
            <button onClick={handleSetLink} className={style.link_confirm}>
              <FontAwesomeIcon icon={faCheck} />
            </button>
            <button
              onClick={() => setShowLinkInput(false)}
              className={style.link_cancel}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        )}
      </div>

      <div className={style.divider}></div>

      {/* 媒體與程式碼 */}
      <div className={style.button_group}>
        <button onClick={handleImageClick} title="插入圖片">
          <FontAwesomeIcon icon={faImage} />
        </button>

        <button
          onClick={handleCodeBlock}
          className={editor.isActive('codeBlock') ? style.active : ''}
          title="程式碼區塊"
        >
          <FontAwesomeIcon icon={faCode} />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={editor.isActive('code') ? style.active : ''}
          title="行內程式碼"
        >
          `
        </button>
      </div>

      <div className={style.divider}></div>

      {/* 其他 */}
      <div className={style.button_group}>
        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="分隔線"
        >
          ―
        </button>

        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="復原 (Ctrl+Z)"
        >
          <FontAwesomeIcon icon={faUndo} />
        </button>

        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="重做 (Ctrl+Y)"
        >
          <FontAwesomeIcon icon={faRedo} />
        </button>
      </div>
    </div>
  )
}
